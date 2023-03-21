const app = require('./app');
const port = 9001;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
