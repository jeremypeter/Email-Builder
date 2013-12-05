/*
 * grunt-EmailBuilder
 * https://github.com/yargalot/Email-Builder
 *
 * Copyright (c) 2013 Steven Miller
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {

  // Please see the grunt documentation for more information regarding task and
  // helper creation: https://github.com/gruntjs/grunt/blob/master/docs/toc.md

  // ==========================================================================
  // TASKS
  // ==========================================================================

  // Task Desciption
  var task_name         = 'emailBuilder';
  var task_description  = 'Compile Files';


  // Required modules
  var juice     = require('juice');
  var http      = require('http');
  var builder   = require('xmlbuilder');
  var path      = require('path');
  var cheerio   = require('cheerio');
  var  _        = grunt.util._;
  var cm        = require('child_process').exec;
  var helpers   = require('grunt-lib-contrib').init(grunt);

  grunt.registerMultiTask(task_name, task_description, function() {

    var options   = this.options();
    var done      = this.async();

    this.files.forEach(function(file) {
      console.log(file.src);

      file.src.filter(function(filepath) {

        var data      = grunt.file.read(filepath);
        var basepath  = process.cwd();
        var $         = cheerio.load(data);
        var date      = String(Math.round(new Date().getTime() / 1000));
        var title     = $('title').text() + date;
        var srcFiles  = [];
        var inlineCss;

        $('link').each(function (i, elem) {

          if (!$(this).attr('data-placement')) return;

          var target = $(this).attr('href');
          var map = {
            file    : target,
            inline  : $(this).attr('data-placement') === 'style-tag' ? false : true
          };

          srcFiles.push(map);

          $(this).remove();
        });

        grunt.file.setBase(path.dirname(file.src));

        srcFiles.forEach(function(input) {
          var data = grunt.file.read(input.file);

          input.inline ? inlineCss = data : $('head').append('<style>' + data + '</style>');
        });

        var output = juice($.html(), inlineCss);

        grunt.file.setBase(basepath);

        grunt.log.writeln('Writing...'.cyan);
        grunt.file.write(file.dest, output);
        grunt.log.writeln('File ' + file.dest.cyan + ' created.');

        if (options.litmus) {

          var command = sendLitmus(output, title);

          cm(command, function(err, stdout, stderr) {
            if (err || stderr)
              console.log(err || stderr, stdout);

            // Delete XML After being curl'd
            grunt.file.delete('data.xml');
          });
        }
      })
    });

    function sendLitmus(data, title) {
      // Write the data xml file to curl, prolly can get rid of this somehow.

      var xml         = xmlBuild(data, title);
      var username    = options.litmus.username;
      var password    = options.litmus.password;
      var accountUrl  = options.litmus.url;
      var command     = 'curl -i -X POST -u ' + username + ':' + password + ' -H \'Accept: application/xml\' -H \'Content-Type: application/xml\' ' + accountUrl + '/emails.xml -d @data.xml';

      // Write xml file
      grunt.file.write('data.xml', xml);

      return command;
    }

    //Application XMl Builder
    function xmlBuild(data, title) {
      var xmlApplications = builder.create('applications').att('type', 'array');

      _.each(options.litmus.applications, function(app) {
        var item = xmlApplications.ele('application');

        item.ele('code', app);
      });

      //Build Xml to send off, Join with Application XMl
      var xml = builder.create('test_set')
        .importXMLBuilder(xmlApplications)
        .ele('save_defaults', 'false').up()
        .ele('use_defaults', 'false').up()
        .ele('email_source')
          .ele('body').dat(data).up()
          .ele('subject', title)
        .end({pretty: true});

      return xml;
    }

  });

};
