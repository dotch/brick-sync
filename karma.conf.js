module.exports = function(config){
  config.set({
    basePath: '.',

    files : [
      'bower_components/platform/platform.js',
      'test/browser.js',
      {pattern: 'src/*', watched: true, included: false, served: true},
      {pattern: 'bower_components/**/*', watched: true, included: false, served: true}
    ],

    autoWatch : true,

    frameworks: ['mocha', 'chai', 'chai-as-promised'],

    browsers : ['Firefox'],

    plugins : [
      'karma-firefox-launcher',
      'karma-mocha',
      'karma-chai',
      'karma-chai-plugins'
    ],
  });
};
