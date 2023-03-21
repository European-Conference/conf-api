const app = require('../app');
const chai = require('chai');
const chaiHttp = require('chai-http');
const shell = require('shelljs')

chai.use(chaiHttp);
const { expect } = chai;

const references = {
    PRESS: 'DEMO01',
    CONF_ONLY: 'DEMO02'
}

describe('Attendee API', () => {
    beforeEach(async () => {
        shell.exec('~/db-scripts/prep_test.sh > /dev/null');
    });

    describe('GET /attendee/:ref', () => {
        it('should return an existing attendee', async () => {
            const ref = references.PRESS;
            const res = await chai.request(app).get(`/attendee/${ref}`);
            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('ref', ref);
            expect(res.body).to.have.property('name', 'Demo Press User');
            expect(res.body).to.have.property('email', 'demopress@euroconf.eu');
            expect(res.body).to.have.property('phone_number', '1234567890');
            expect(res.body).to.have.property('type', 'press');
        });

        it('correctly sets accessConf, accessGala and transferable', async () => {
            const resPress = await chai.request(app).get(`/attendee/${references.PRESS}`);
            const resConfOnly = await chai.request(app).get(`/attendee/${references.CONF_ONLY}`);

            expect(resPress.body).to.have.property('accessConf', true);
            expect(resPress.body).to.have.property('accessGala', true);
            expect(resPress.body).to.have.property('transferable', false);
            expect(resConfOnly.body).to.have.property('accessConf', true);
            expect(resConfOnly.body).to.have.property('accessGala', false);
            expect(resConfOnly.body).to.have.property('transferable', true);
        });

        it('should return a 404 status for a non-existent attendee', async () => {
            const res = await chai.request(app).get('/attendee/NON_EXISTENT_REF');
            expect(res.status).to.equal(404);
            expect(res.body).to.have.property('error', 'Attendee not found');
        });
    });

    describe('PUT /attendee/:ref', () => {
        it('should refuse to transfer an attendee that is not transferrable', async () => {
            const ref = references.PRESS;
            const res = await chai.request(app).put(`/attendee/${ref}`).send({
                name: 'Demo User 2',
                email: 'updatedemail@euroconf.eu',
                transfer: true
            });
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Attendee cannot be transferred');
        });

        it('should refuse to transfer an attendee to an email that is already in use', async () => {
            const ref = references.CONF_ONLY;
            const res = await chai.request(app).put(`/attendee/${ref}`).send({
                name: 'Demo User 2',
                email: 'demopress@euroconf.eu', // This email is already in use
                transfer: true
            });

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Email already in use');
        });

        it('should transfer an attendee to a new email', async () => {
            const ref = references.CONF_ONLY;
            const res = await chai.request(app).put(`/attendee/${ref}`).send({
                name: 'Demo User 2',
                email: 'newemail@euroconf.eu',
                transfer: true
            });

            expect(res.status).to.equal(200);
            expect(res.body.obj).to.have.property('ref', ref);
            expect(res.body.obj).to.have.property('name', 'Demo User 2');
            expect(res.body.obj).to.have.property('email', 'newemail@euroconf.eu');
            expect(res.body.obj).to.have.property('phone_number', '1234567890');
        });

        it('should transfer an attendee to the same email and new name', async () => {
            const ref = references.CONF_ONLY;
            const res = await chai.request(app).put(`/attendee/${ref}`).send({
                name: 'Demo User 3',
                email: 'demopressuser2@euroconf.eu',
                transfer: true
            });

            expect(res.status).to.equal(200);
            expect(res.body.obj).to.have.property('ref', ref);
            expect(res.body.obj).to.have.property('name', 'Demo User 3');
            expect(res.body.obj).to.have.property('email', 'demopressuser2@euroconf.eu');
        });

        it('should register an attendee', async () => {
            let testPreferences = JSON.stringify({ test: 'Foo' });
            let res = await chai.request(app).put(`/attendee/${references.CONF_ONLY}`).send({
                'registered': true,
                'preferences': testPreferences,
                'phone_number': '1234',
                'affiliation': 'Test Affiliation'
            });

            expect(res.status).to.equal(200);
            expect(res.body.obj).to.have.property('registered', true);
            //expect(res.body.obj).to.have.property('preferences', testPreferences);
            expect(res.body.obj).to.have.property('phone_number', '1234');
            expect(res.body.obj).to.have.property('affiliation', 'Test Affiliation');
        });
    });
});



