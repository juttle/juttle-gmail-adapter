'use strict';

// Compiler that transforms filter expression AST into a gmail search expression.
//
// The expression is returned from the compile method.

var StaticFilterCompilerBase = require('./static-filter-compiler-base');
var JuttleErrors = require('juttle/lib/errors');
var JuttleMoment = require('juttle/lib/moment').JuttleMoment;
var values = require('juttle/lib/runtime/values');
var _ = require('underscore');

// FilterGmailCompiler derives from ASTVisitor which provides a way to
// traverse the abstract syntax tree that the juttle compiler
// generates for the read command's filter expression.
//
// While traversing the tree, callbacks are called for the various
// parts of the filter expression. The FilterGmailCompiler object maps
// individual items in the tree into appropriate gmail advanced search
// (https://support.google.com/mail/answer/7190?hl=en) terms. As the
// tree is traversed, these items are combined into a complete gmail
// search expression. This is used when reading messages.

class FilterGmailCompiler extends StaticFilterCompilerBase {
    constructor(options) {
        super();

        this.location = options.location;
        this.supported_headers = ["from", "to", "subject", "cc", "bcc"];
    }

    compileLiteral(node) {
        if (node.type == 'StringLiteral') {
            return node.value;
        } else {
            throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                            {proc: 'read gmail', filter: values.typeDisplayName(values.typeOf(values.fromAST(node)))});
        }
    }

    compileField(node) {
        return node.name;
    }

    compileFulltextTerm(node) {
        return "\"" + node.value + "\"";
    }

    compileExpressionTerm(node) {
        var filter, header, value;

        switch (node.operator) {
            // The gmail search syntax only supports substring matches
            // (as compared to exact matches), so we only support
            // substring matches here.
            case '=~':
                header = this.compile(node.left);
                value = this.compile(node.right);

                if (! _.contains(this.supported_headers, header)) {
                    throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                                    {proc: 'read gmail', filter: "searching on header " + header});
                }

                filter = header + ":" + "\"" + value + "\"";

                break;

            case '!~':
                header = this.compile(node.left);
                value = this.compile(node.right);

                if (! _.contains(this.supported_headers, header)) {
                    throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                                    {proc: 'read gmail', filter: "searching on header " + header});
                }

                filter = "-" + header + ":" + "\"" + value + "\"";

                break;

            default:
                throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                                {proc: 'read gmail', filter: "operator " + node.operator});
        }

        return filter;
    }

    compileAndExpression(node) {
        var left = this.compile(node.left);
        var right = this.compile(node.right);

        return "(" + left + " " + right + ")";
    }

    compileOrExpression(node) {
        var left = this.compile(node.left);
        var right = this.compile(node.right);

        return "(" + left + " OR " + right + ")";
    }

    compileNotExpression(node) {
        return '-' + this.compile(node.expression);
    }
}

module.exports = FilterGmailCompiler;
