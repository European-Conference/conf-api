const fs = require('fs');
const { parse } = require('csv-parse');
const { Client } = require('pg');
const config = require('./config-writer')

const csvFilePath = process.argv[2];
const execute = process.argv.includes('--execute');

if (!csvFilePath) {
    console.error('Please provide a CSV file path as a command line argument.');
    process.exit(1);
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const client = new Client(config.database);
client.connect();

fs.readFile(csvFilePath, (err, fileData) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    parse(fileData, {
        columns: true,
        skip_empty_lines: true
    }, async (err, rows) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        try {
            await client.query('BEGIN');

            for (const row of rows) {
                const { name, email } = row;

                const existingTicket = await client.query('SELECT ref FROM attendees WHERE email = $1', [email]);
                if (existingTicket.rows.length === 0) {
                    console.log(`No ticket found for ${email}. Skipping.`);
                    continue;
                }

                const ref = existingTicket.rows[0].ref;
                const result = await client.query(
                    'UPDATE attendees SET name = $1 WHERE ref = $2',
                    [name, ref]
                );
                console.log(`${execute ? 'ACTION:' : 'DRYRUN:'} Update name for ${email} to ${name}.`);
            }

            if (execute) {
                await client.query('COMMIT');
                console.log('All rows updated successfully.');
            } else {
                await client.query('ROLLBACK');
                console.log('Dry run. No rows were actually updated.');
            }

            client.end();
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            console.log("Rolling back changes. No rows were updated.");
            process.exit(1);
        }
    });
});
