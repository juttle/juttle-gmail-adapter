'use strict';

// Compiler that transforms filter expression AST into a gmail search expression.
//
// The expression is returned from the compile method.

/* global JuttleAdapterAPI */
let StaticFilterCompiler = JuttleAdapterAPI.compiler.StaticFilterCompiler;
var _ = require('underscore');

// FilterGmailCompiler derives from StaticFilterCompiler which provides a way to
// traverse the abstract syntax tree that the juttle compiler
// generates for the read command's filter expression.
//
// While traversing the tree, callbacks are called for the various
// parts of the filter expression. The FilterGmailCompiler object maps
// individual items in the tree into appropriate gmail advanced search
// (https://support.google.com/mail/answer/7190?hl=en) terms. As the
// tree is traversed, these items are combined into a complete gmail
// search expression. This is used when reading messages.

const SUPPORTED_HEADERS = [
    'from',
    'to',
    'subject',
    'cc',
    'bcc'
];

class FilterGmailCompiler extends StaticFilterCompiler {

    static supported_headers() {
        return SUPPORTED_HEADERS;
    }

    constructor(options) {
        super(options);
    }

    visitStringLiteral(node) {
        return node.value;
    }

    visitUnaryExpression(node) {
        if (node.operator === 'NOT') {
            return '-' + this.visit(node.argument);
        } else {
            this.featureNotSupported(node, 'operator ' + node.operator);
        }
    }

    visitField(node) {
        return node.name;
    }

    visitBinaryExpression(node) {
        var left, right, filter, header, value;

        switch (node.operator) {
            case 'AND':
                left = this.visit(node.left);
                right = this.visit(node.right);

                filter = `(${left} ${right})`;
                break;

            case 'OR':
                left = this.visit(node.left);
                right = this.visit(node.right);

                filter = `(${left} OR ${right})`;

                break;

            // The gmail search syntax only supports substring matches
            // (as compared to exact matches), so we only support
            // substring matches here.
            case '=~':
                header = this.visit(node.left);
                value = this.visit(node.right);

                if (! _.contains(FilterGmailCompiler.supported_headers(), header)) {
                    this.featureNotSupported(node, 'searching on header ' + header);
                }

                filter = `${header}:"${value}"`;

                break;

            case '!~':
                header = this.visit(node.left);
                value = this.visit(node.right);

                if (! _.contains(FilterGmailCompiler.supported_headers(), header)) {
                    this.featureNotSupported(node, 'searching on header ' + header);
                }

                filter = `-${header}:"${value}"`;

                break;

            default:
                this.featureNotSupported(node, 'operator ' + node.operator);
        }

        return filter;
    }

    visitFulltextFilterTerm(node) {
        return `"${node.text}"`;
    }
}

module.exports = FilterGmailCompiler;
