'use strict';

var eslint = require('gulp-eslint');
var gulp = require('gulp');
var istanbul = require('gulp-istanbul');
var mocha = require('gulp-mocha');

gulp.task('lint', function() {
    return gulp.src([
        'gulpfile.js',
        'test/**/*.js',
        'lib/**/*.js'
    ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('instrument', function () {
    return gulp.src([
        'lib/**/*.js',
    ])
    .pipe(istanbul({
        includeUntested: true
    }))
    .pipe(istanbul.hookRequire());
});

function gulp_test() {
    return gulp.src('test/**/*.spec.js')
    .pipe(mocha({
        log: true,
        timeout: 10000,
        slow: 3000,
        reporter: 'spec',
        ui: 'bdd'
    }));
}

gulp.task('test', function() {
    return gulp_test();
});

gulp.task('test-coverage', ['instrument'], function() {
    return gulp_test()
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({
        thresholds: {
            global: {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100
            }
        }
    }));
});
