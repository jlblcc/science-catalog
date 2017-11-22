let express = require('express')
    Resource = require('odata-resource'),
    app = express(),
    db = require('./db');

app.use(require('body-parser').json());

app.get('/',(req,res) => {
    res.send('science catalog api');
});

let project = new Resource({
    rel: '/api/project',
    model: require('./db/models/Project'),
    // query arg defaults
    $top: 5,
    $orderby: 'title',
    $orderbyPaged: 'title'
});

project.initRouter(app);

db().then(() => {
        let server = app.listen(8989,() => {
            console.log(`listening on ${server.address().port}`)
        });
    }).catch(e => {
        console.error(e);
        process.exit(1);
    });
