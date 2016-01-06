// Compiler that transforms filter expression AST into a gmail search expression.
//
// The expression is returned from the compile method.

var ASTVisitor = require('juttle/lib/compiler/ast-visitor');
var JuttleErrors = require('juttle/lib/errors');
var JuttleMoment = require('juttle/lib/moment').JuttleMoment;
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

var FilterGmailCompiler = ASTVisitor.extend({
    initialize: function(options) {
        this.location = options.location;
        this.supported_headers = ["from", "to", "subject", "cc", "bcc"];
    },

    compile: function(node) {
        return this.visit(node);
    },

    visitStringLiteral: function(node) {
        return node.value;
    },

    visitFilterLiteral: function(node) {
        return this.visit(node.ast);
    },

    visitUnaryExpression: function(node) {
        switch (node.operator) {
            case 'NOT':
                return '-' + this.visit(node.expression);

            // '*' is the field dereferencing operator. For example,
            // given a search string from ~ 'bob', the UnaryExpression
            // * on from means "the field called from".
            case '*':
                return this.visit(node.expression);

            default:

                throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                                {proc: 'read gmail', filter: "operator " + node.operator});
        }
    },

    visitBinaryExpression: function(node) {
        var left, right, filter, header, value;

        switch (node.operator) {
            case 'AND':
                left = this.visit(node.left);
                right = this.visit(node.right);

                filter = "(" + left + " " + right + ")";
                break;

            case 'OR':
                left = this.visit(node.left);
                right = this.visit(node.right);

                filter = "(" + left + " OR " + right + ")";

                break;

            // The gmail search syntax only supports substring matches
            // (as compared to exact matches), so we only support
            // substring matches here.
            case '=~':
                header = this.visit(node.left);
                value = this.visit(node.right);

                if (! _.contains(this.supported_headers, header)) {
                    throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                                    {proc: 'read gmail', filter: "searching on header " + header});
                }

                filter = header + ":" + "\"" + value + "\"";

                break;

            case '!~':
                header = this.visit(node.left);
                value = this.visit(node.right);

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
    },

    visitExpressionFilterTerm: function(node) {
        return this.visit(node.expression);
    },

    visitSimpleFilterTerm: function(node) {
        switch (node.expression.type) {
            case 'StringLiteral':
            case 'FilterLiteral':
                return "\"" + this.visit(node.expression) + "\"";

            default:
                throw JuttleErrors.compileError('RT-ADAPTER-UNSUPPORTED-FILTER',
                                                {proc: 'read gmail', filter: "filter term " + node.expression.type});
        }
    }
});

module.exports = FilterGmailCompiler;
