var tooltipTemplate = _.template(document.getElementById('tooltip-template').innerHTML);

function loadJSON(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.overrideMimeType('application/json');
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(null, JSON.parse(xhr.responseText));
      } else {
        callback(new Error(xhr.responseText));
      }
    }
  };
  xhr.send(null);
}

function drawChart(el, dataTable) {
  var options = {
    height: 100,
    hAxis: {
      format: 'h:mm a'
    },
    tooltip: {
      isHtml: true
    },
    timeline: {
      colorByRowLabel: true,
      rowLabelStyle: { fontName: 'Roboto' },
      barLabelStyle: { fontName: 'Roboto' }
    }
  };

  var chart = new google.visualization.Timeline(el);

  google.visualization.events.addListener(chart, 'ready', function() {
    var charts = el.querySelectorAll('svg');
    if (charts.length < 2) return;

    var height = charts[1].offsetHeight + 64;
    options.height = height;

    chart.draw(dataTable, options)
  });

  chart.draw(dataTable, options);

  window.addEventListener("resize", _.debounce(function(e) {
    chart.draw(dataTable, options);
  }));

  return chart;
}

function convertMomentToDate(m) {
  return new Date(m.year(), m.month(), m.date(), m.hours(), m.minutes(), m.seconds());
}

google.setOnLoadCallback(function() {
  loadJSON('schedule_lite.json', function(err, schedule) {
    if (err != null) {
      console.error(err);
      return;
    }

    // convert times to moment objects which handle timezones better
    schedule = _.map(schedule, function(session) {
      var start = new Date(session.start);
      var end = new Date(session.end);
      session.start = moment(start).tz('EST');
      session.end = moment(end).tz('EST');

      session.description = session.description || '';
      session.authorString = session.authors.join(', ');
      session.startString = session.start.format('h:mm A');
      session.endString = session.end.format('h:mm A');
      session.duration = moment.duration(end.getTime() - start.getTime()).humanize();
      return session;
    });

    // group data into days and sort by type for each day
    var days = _.chain(schedule).values().groupBy(function(session) {
      return session.start.date();
    }).map(function(day) {
      return _.sortBy(day, 'start');
    }).values().value();

    days.forEach(function(day) {
      // Collapse posters
      day = _.chain(day).reduce(function(day, session) {
        if (session.type === 'Poster') {
          session = day['poster'] = _.defaults({
            title: 'Posters',
            type: 'Poster',
            authorString: ''
          }, _.pick(session, ['start', 'end', 'room', 'startString', 'endString', 'duration', 'description']));
        } else {
          day[session.id] = session;
        }
        return day;
      }, {}).values().value();

      var title = day[0].start.format('dddd, MMM D');

      var data = day.map(function(session) {
        return [
          session.type,
          session.title,
          tooltipTemplate(session),
          convertMomentToDate(session.start),
          convertMomentToDate(session.end)
        ];
      });

      var headerEl = document.createElement('h2');
      headerEl.innerText = title;

      var chartEl = document.createElement('div');
      chartEl.className = 'chart';

      var rootEl = document.getElementById('schedule');
      rootEl.appendChild(headerEl);
      rootEl.appendChild(chartEl);

      var dataTable = new google.visualization.DataTable();
      dataTable.addColumn({ type: 'string', id: 'Type' });
      dataTable.addColumn({ type: 'string', id: 'Title' });
      dataTable.addColumn({ type: 'string', role: 'tooltip', 'p': { 'html': true } });
      dataTable.addColumn({ type: 'datetime', id: 'Start' });
      dataTable.addColumn({ type: 'datetime', id: 'End' });
      dataTable.addRows(data);

      drawChart(chartEl, dataTable);
    });
  });
});
