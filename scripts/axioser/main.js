#!/usr/bin/env node
var axios = require('axios')

var stdin = process.stdin,
    stdout = process.stdout,
    inputChunks = [];

stdin.setEncoding('utf8');

stdin.on('data', function (chunk) {
    inputChunks.push(chunk);
});

stdin.on('end', async function () {
    var inputJSON = inputChunks.join()
    var input = JSON.parse(inputJSON)
    //var outputJSON = JSON.stringify(parsedData, null, '    ');

    try {
      var result = await axios(input)
      stdout.write(JSON.stringify(result.data, null, '    '));
      //console.log(result)
      stdout.write('\n');
    } catch(e) {
      console.log("umm")
      console.log(e)
    }
});
