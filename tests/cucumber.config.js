const config = {
  default: {
    require: ['tests/step-definitions/**/*.js'],
    format: ['progress', 'html:tests/reports/cucumber-report.html'],
    parallel: 1,
    retry: 1,
    timeout: 30000
  }
}

module.exports = config;