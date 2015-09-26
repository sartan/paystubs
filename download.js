var casper = require('casper').create({verbose: true});
var fs = require('fs');
var config = require('config.json');

casper.start(config.loginUrl, logIn).then(downloadAll).run();

casper.on('downloaded.file', function (target) {
  console.log('Writing ' + target);
});

function logIn() {
  var form = 'form[name=login]';

  if (!casper.exists(form)) {
    console.log('Login form not found, exiting').exit();
  }

  console.log('Logging in...');

  casper.fill(form, {
    'j_username': config.username,
    'j_password': config.password
  }, true);

  casper.then(function () {
    if (casper.exists(form)) {
      console.log('Login failed, exiting').exit();
    }
  });
}

function downloadAll() {
  casper.thenOpen(config.paystubUrl, function () {
    var first = config.baseUrl + this.getElementAttribute('a[href^=\'TCPayStub\']', 'href');
    casper.then(function () {
      downloadOne(first);
    });
  });
}

function downloadOne(url) {
  casper.thenOpen(url, {method: 'head'}, function (response) {
    if (!isPdf(response)) {
      console.log('Done');
      return;
    }

    var payPeriod = url.match(/payPeriod=(.*)&/i)[1];
    var dest = config.outputDir + fs.separator + payPeriod + '.pdf';

    if (!fs.exists(dest) || config.overwrite) {
      casper.download(url, dest);
    } else {
      console.log(dest + ' already exists, skipping');
    }

    downloadOne(url.replace(payPeriod, priorPayPeriod(payPeriod)));
  });
}

function isPdf(httpResponse) {
  return ((httpResponse.headers.get('Content-type').toLowerCase()) === 'application/pdf');
}

function priorPayPeriod(current) {
  var periodNum = current.substring(5, 7);

  if (periodNum !== '01') {
    return zeroPad(--current, 7);
  }

  var curYear = current.substring(0, 2);
  var prevYear = zeroPad(--curYear, 2);

  return (prevYear + current.substring(2, 5) + '26'); // last pay period of previous year
}

function zeroPad(num, paddedLen) {
  var len = num.toString().length;
  return (len >= paddedLen) ? num : (new Array(paddedLen - len).join('0')) + num;
}