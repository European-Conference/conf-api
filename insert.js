const fs = require('fs');
const { parse } = require('csv-parse');
const { Client } = require('pg');
const config = require('./config-writer')

const csvFilePath = process.argv[2];
const execute = process.argv.includes('--execute');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

if (!csvFilePath) {
    console.error('Please provide a CSV file path as a command line argument.');
    process.exit(1);
}

const client = new Client(config.database);
client.connect();

const createReference = () => {
    const possibleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let reference = '';
    for (let i = 0; i < 6; i++) {
        reference += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
    }
    return reference;
};

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
        let ticketsCreated = 0;
        let ticketsSkipped = 0;
        try {
            await client.query('BEGIN');

            for (const row of rows) {
                const { name, type, phone_number, email, source } = row;

                const existingTicket = await client.query('SELECT ref FROM attendees WHERE email = $1 OR original_email = $2', [email, row.original_email || '']);
                if (existingTicket.rows.length > 0) {
                    console.log(`Ticket for ${name} (${email}) already exists with ref ${existingTicket.rows[0].ref}. Skipping.`);
                    ticketsSkipped++;
                    continue;
                }

                const reference = createReference();
                console.log(`Creating ticket for ${name} (${email}) with ref ${reference}.`);
                const result = await client.query(
                    'INSERT INTO attendees (ref, name, type, phone_number, email, source, original_email) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [reference, name, type, phone_number, email, source, email]
                );
                console.log(`${execute ? 'ACTION:' : 'DRYRUN:'} Insert row for ${name} (${email}) with ref ${reference}.`);
                ticketsCreated++;
            }

            console.log("\n=====");
            console.log(`${ticketsCreated} tickets to be created, ${ticketsSkipped} tickets skipped because they would be duplicates.`);
            if (execute) {
                await client.query('COMMIT');
                console.log('All rows inserted successfully.');
            } else {
                await client.query('ROLLBACK');
                console.log('Dry run. No rows were actually inserted.');
            }

            client.end();
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            console.log("Rolling back changes. No rows were inserted.");
            process.exit(1);
        }
    });
});
