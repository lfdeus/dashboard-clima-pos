// Karma configuration for the Dashboard de Clima project.
// See https://karma-runner.github.io/6.4/config/configuration-file.html
const fs = require('fs');
const path = require('path');

/**
 * Reporter que grava o resultado de cada teste em JSON, para o portão de qualidade do CI
 * (scripts/ci/avaliar-testes.mjs) e para o agente de diagnóstico (scripts/ia/).
 * Só é ativado quando a variável KARMA_RESULTADOS_JSON aponta o arquivo de saída.
 */
function ResultadoJsonReporter(baseReporterDecorator) {
  baseReporterDecorator(this);

  const destino = path.resolve(process.env.KARMA_RESULTADOS_JSON);
  let testes = [];

  const iniciarExecucaoBase = this.onRunStart;
  this.onRunStart = (...args) => {
    testes = [];
    iniciarExecucaoBase.apply(this, args);
  };

  this.onSpecComplete = (browser, result) => {
    testes.push({
      nome: [...result.suite, result.description].join(' '),
      sucesso: result.success,
      pulado: result.skipped,
      mensagens: result.log,
      navegador: browser.name
    });
  };

  this.onRunComplete = (browsers, results) => {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(
      destino,
      JSON.stringify(
        {
          resumo: {
            passaram: results.success,
            falharam: results.failed,
            erroDeExecucao: Boolean(results.error),
            navegadorDesconectou: Boolean(results.disconnected)
          },
          testes
        },
        null,
        2
      )
    );
  };
}
ResultadoJsonReporter.$inject = ['baseReporterDecorator'];

const gravarResultados = Boolean(process.env.KARMA_RESULTADOS_JSON);

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
      { 'reporter:resultado-json': ['type', ResultadoJsonReporter] }
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/dashboard-clima'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' }
      ],
      check: {
        global: {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70
        }
      }
    },
    reporters: gravarResultados ? ['progress', 'resultado-json'] : ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu']
      }
    },
    restartOnFileChange: true
  });
};
