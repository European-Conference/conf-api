const express = require('express');
const { Pool } = require('pg');
const config = require('./config');
const bodyParser = require('body-parser');

const app = express();
const port = 9001;
const ENABLE_DEMO = true;
const TEST_MAKE_ALL_TRANSFERABLE = false;

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

app.use(bodyParser.json());

// Create a PostgreSQL database connection pool
const pool = new Pool(config.database)

const retrieveAttendee = async (ref) => {
    if (ENABLE_DEMO && (typeof ref === 'string') && ref.toLowerCase() === 'demo') {
        return {
            ref: 'DEMO',
            name: 'Demo User',
            email: 'demo@demo.com',
            original_email: 'demo@demo.com',
            phone_number: '0123456789',
            type: 'conf-gala',
            affiliation: 'None',
            accessConf: true,
            accessGala: true,
            transferable: true
        };
    }

    const result = await pool.query('SELECT * FROM attendees WHERE ref = $1', [ref]);
    if (result.rowCount === 1) {
        const attendee = result.rows[0];
        const accessConf = true;
        const accessGala = ['conf-gala', 'volunteer', 'press', 'speaker', 'organizer', 'delegation', 'invitee', 'speaker-invitee'].includes(attendee.type);
        let transferable = ['conf-gala', 'conf-only'].includes(attendee.type) && attendee.email === attendee.original_email;

        if (TEST_MAKE_ALL_TRANSFERABLE) {
            transferable = true;
        }

        return { ...attendee, accessConf, accessGala, transferable };
    } else if (result.rowCount > 1) {
        throw new Error('Multiple attendees found');
    } else {
        return null;
    }
}

const retrieveAttendeeCountByEmail = async (email, ref) => {
    const result = await pool.query('SELECT * FROM attendees WHERE email = $1 AND ref != $2', [email, ref]);
    return result.rowCount;
};

// Define the route to retrieve an attendee by ref
app.get('/attendee/:ref', async (req, res) => {
    const ref = req.params.ref;

    try {
        const attendee = await retrieveAttendee(ref);
        if (attendee === null) {
            res.status(404).json({ error: 'Attendee not found' });
            return;
        }
        res.json(attendee);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/attendee/:ref', async (req, res) => {
    console.log(req.body);
    const ref = req.params.ref;
    const { name, email, phone_number, preferences, transfer, registered, affiliation } = req.body;
    var attendee;
    try {
        attendee = await retrieveAttendee(ref);
        if (attendee === null) {
            res.status(404).json({ error: 'Attendee not found' });
            return;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }

    if (transfer) {
        if (!attendee.transferable) {
            res.status(400).json({ error: 'Attendee cannot be transferred' });
            return;
        }

        if (await retrieveAttendeeCountByEmail(email, ref) > 0) {
            res.status(400).json({ error: 'Email already in use' });
            return;
        }
    }

    try {
        let result;
        if (transfer) {
            result = await pool.query('UPDATE attendees SET name = $1, email = $2 WHERE ref = $3', [name, email, ref]);
        } else {
            result = await pool.query('UPDATE attendees SET phone_number = $1, preferences = $2, registered = $3, affiliation = $4 WHERE ref = $5', [phone_number, preferences, registered, affiliation, ref])
        }
        if (result.rowCount === 1) {
            let obj = await retrieveAttendee(ref);
            res.json({ success: true, obj });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = app;