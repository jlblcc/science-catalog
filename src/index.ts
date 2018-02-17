/**
 * Gets the API server running...
 */
import {db} from './db';
import app from './Server';

db().then(() => {
    let server = app.listen(8989,() => {
        console.log(`listening on ${server.address().port}`)
    });
}).catch(e => {
    console.error(e);
    process.exit(1);
});
