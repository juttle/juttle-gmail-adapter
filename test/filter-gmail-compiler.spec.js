var JuttleParser = require('juttle/lib/parser');
var SemanticPass = require('juttle/lib/compiler/semantic');
var JuttleErrors = require('juttle/lib/errors');
var JuttleMoment = require('juttle/lib/moment').JuttleMoment;
var FilterGmailCompiler = require('../lib/filter-gmail-compiler');
var expect = require('chai').expect;

function verify_compile_error(source, filter) {
    var ast = JuttleParser.parseFilter(source).ast;

    var semantic = new SemanticPass({ now: new JuttleMoment() });
    semantic.sa_expr(ast);

    var compiler = new FilterGmailCompiler({location: ast.location});
    try {
        var search_expr = compiler.compile(ast);
    } catch (e) {
        expect(e).to.be.instanceOf(JuttleErrors.CompileError);
        expect(e.code).to.equal("RT-ADAPTER-UNSUPPORTED-FILTER");
        expect(e.info.filter).to.equal(filter);
    }
}

function verify_compile_success(source, expected) {
    var ast = JuttleParser.parseFilter(source).ast;

    var semantic = new SemanticPass({ now: new JuttleMoment() });
    semantic.sa_expr(ast);

    var compiler = new FilterGmailCompiler({location: ast.location});
    var search_expr = compiler.compile(ast);
    expect(search_expr).to.equal(expected);
}

describe('gmail filter', function() {

    describe(' properly returns errors for invalid filtering expressions like ', function() {

        var invalid_unary_operators = ['!', '-'];

        invalid_unary_operators.forEach(function(op) {
            it('using unary operator ' + op + ' in field specifications', function() {
                verify_compile_error("subject ~ " + op + " \"foo\"",
                                     "operator " + op);
            });
        });

        var invalid_operators = ['==', '!=', '<', '<=', '>', '>=', 'in'];
        invalid_operators.forEach(function(op) {
            it('using ' + op + ' in field comparisons', function() {
                verify_compile_error("subject " + op + " \"foo\"",
                                     "operator " + op);
            });
        });

        it('matching on unsupported headers', function() {
            verify_compile_error("not_a_header ~ \"foo\"",
                                 "searching on header not_a_header");
        });

        it('not a filter expression or string', function() {
            verify_compile_error("+ 1",
                                 "filter term UnaryExpression");
        });
    });

    describe(' properly returns gmail search expressions for valid cases like ', function() {
        it('Simple full-text match', function() {
            verify_compile_success("\"foo\"",
                                   "\"foo\"");
        });

        it('Simple full-text match using a phrase', function() {
            verify_compile_success("\"a phrase\"",
                                   "\"a phrase\"");
        });

        var supported_headers = new FilterGmailCompiler({location: 0}).supported_headers;
        supported_headers.forEach(function(hdr) {
            it('Matching with header ' + hdr, function() {
                verify_compile_success(hdr + " ~ \"foo\"",
                                       hdr + ":\"foo\"");
            });
        });

        supported_headers.forEach(function(hdr) {
            it('Matching with header ' + hdr + ' and a phrase', function() {
                verify_compile_success(hdr + " ~ \"a phrase\"",
                                       hdr + ":\"a phrase\"");
            });
        });

        it('Not matching a single header', function() {
            verify_compile_success("subject !~ \"foo\"",
                                   "-subject:\"foo\"");
        });

        it('Not matching a single header with a phrase', function() {
            verify_compile_success("subject !~ \"a phrase\"",
                                   "-subject:\"a phrase\"");
        });

        it('Matching a single header AND a full-text search', function() {
            verify_compile_success("\"some text\" AND subject ~ \"a phrase\"",
                                   "(\"some text\" subject:\"a phrase\")");
        });

        it('Matching a single header OR a full-text search', function() {
            verify_compile_success("\"some text\" OR subject ~ \"a phrase\"",
                                   "(\"some text\" OR subject:\"a phrase\")");
        });

        it('Matching two headers with AND', function() {
            verify_compile_success("to ~ \"bob\" AND subject ~ \"a phrase\"",
                                   "(to:\"bob\" subject:\"a phrase\")");
        });

        it('Matching two headers with OR', function() {
            verify_compile_success("to ~ \"bob\" OR subject ~ \"a phrase\"",
                                   "(to:\"bob\" OR subject:\"a phrase\")");
        });

        it('Mix of match and non-match with OR', function() {
            verify_compile_success("to ~ \"bob\" OR subject !~ \"a phrase\"",
                                   "(to:\"bob\" OR -subject:\"a phrase\")");
        });

        it('Using NOT with a full-text match', function() {
            verify_compile_success("NOT \"text\"",
                                   "-\"text\"");
        });

        it('Using NOT with a single-header match', function() {
            verify_compile_success("NOT subject ~ \"foo\"",
                                   "-subject:\"foo\"");
        });

        it('Using NOT with AND on a single term', function() {
            verify_compile_success("\"foo\" AND NOT subject ~ \"foo\"",
                                   "(\"foo\" -subject:\"foo\")");
        });

        it('Using NOT with OR on a single term', function() {
            verify_compile_success("\"foo\" OR NOT subject ~ \"foo\"",
                                   "(\"foo\" OR -subject:\"foo\")");
        });

        it('Using NOT with AND on multiple terms', function() {
            verify_compile_success("\"foo\" AND NOT (subject ~ \"foo\" AND subject ~ \"bar\")",
                                   "(\"foo\" -(subject:\"foo\" subject:\"bar\"))");
        });

        it('Using NOT with OR on multiple terms', function() {
            verify_compile_success("\"foo\" OR NOT (subject ~ \"foo\" OR subject ~ \"bar\")",
                                   "(\"foo\" OR -(subject:\"foo\" OR subject:\"bar\"))");
        });

        it('Using NOT with AND on a mix of full-text and header matches', function() {
            verify_compile_success("to ~ \"me\" AND NOT (\"title\" AND subject ~ \"bar\")",
                                   "(to:\"me\" -(\"title\" subject:\"bar\"))");
        });

        it('Using OR with AND on a mix of full-text and header matches', function() {
            verify_compile_success("to ~ \"me\" OR (\"title\" AND subject ~ \"bar\")",
                                   "(to:\"me\" OR (\"title\" subject:\"bar\"))");
        });

        it('Using AND with parentheses', function() {
            verify_compile_success("(to ~ \"me\" AND from ~ \"bob\") AND (\"title\" AND subject ~ \"bar\")",
                                   "((to:\"me\" from:\"bob\") (\"title\" subject:\"bar\"))");
        });

        it('Using OR with parentheses', function() {
            verify_compile_success("(to ~ \"me\" OR from ~ \"bob\") OR (\"title\" AND subject ~ \"bar\")",
                                   "((to:\"me\" OR from:\"bob\") OR (\"title\" subject:\"bar\"))");
        });

        it('Using AND NOT with parentheses', function() {
            verify_compile_success("(to ~ \"me\" AND NOT from ~ \"bob\") AND NOT (\"title\" AND NOT subject ~ \"bar\")",
                                   "((to:\"me\" -from:\"bob\") -(\"title\" -subject:\"bar\"))");
        });

        it('Using OR NOT with parentheses', function() {
            verify_compile_success("(to ~ \"me\" OR NOT from ~ \"bob\") OR NOT (\"title\" OR NOT subject ~ \"bar\")",
                                   "((to:\"me\" OR -from:\"bob\") OR -(\"title\" OR -subject:\"bar\"))");
        });

        it('Multiple levels of parentheses', function() {
            verify_compile_success("(NOT \"a phrase\" AND NOT (from ~ \"bob\" OR subject ~ \"some subject\" AND NOT \"body\")) AND (\"title\" OR NOT subject ~ \"bar\")",
                                   "((-\"a phrase\" -(from:\"bob\" OR (subject:\"some subject\" -\"body\"))) (\"title\" OR -subject:\"bar\"))");
        });

    });
});
