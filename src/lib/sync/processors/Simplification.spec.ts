import { fiscalYear, fiscalYears } from './Simplification';
import { expect } from 'chai';

describe('Simplification',() => {
    it('fiscalYear',() => {
        expect(fiscalYear('2012-01-01')).to.equal(2012);
        expect(fiscalYear('2012-10-01')).to.equal(2013);
    });

    it('fiscalYears',() => {
        let years = fiscalYears({
            startDateTime: '2012-10-01',
            endDateTime: '2014-09-30'
        });
        expect(years).to.be.instanceof(Array).with.length(2);
        expect(years[0]).to.equal(2014);
        expect(years[1]).to.equal(2013);

        years = fiscalYears(null);
        expect(years).to.be.instanceof(Array).with.length(0);

        years = fiscalYears({
            startDateTime: '2014-01-01'
        });
        expect(years).to.be.instanceof(Array).with.length(1);
        expect(years[0]).to.equal(2014);

        years = fiscalYears({
            startDateTime:'2014-01-01',
            endDateTime: '2014-02-01'
        });
        expect(years).to.be.instanceof(Array).with.length(1);
        expect(years[0]).to.equal(2014);
    });

    it('fiscalYears (array)',() => {
        let years = fiscalYears([{
            startDateTime: '2014-10-01T05:00:00.000Z',
            endDateTime: '2015-10-01T04:59:59.999Z'
        },{
            startDateTime: '2015-10-01T05:00:00.000Z',
            endDateTime: '2016-10-01T04:59:59.999Z'
        }]);
        expect(years).to.be.instanceof(Array).with.length(3);
        [2017, 2016, 2015].forEach((y,i) => expect(years[i]).to.equal(y))

        years = fiscalYears([{
            startDateTime: '2014-10-01T05:00:00.000Z',
            endDateTime: '2018-09-30T04:59:59.999Z'
        },{
            startDateTime: '2015-10-01T05:00:00.000Z',
            endDateTime: '2016-10-01T04:59:59.999Z'
        }]);
        expect(years).to.be.instanceof(Array).with.length(4);
        [2018, 2017, 2016,2015].forEach((y,i) => expect(years[i]).to.equal(y))
    });

    it('fiscalYears (negative)',() => {
        try {
            fiscalYears({
                startDateTime: '2014-09-30',
                endDateTime: '2012-10-01'
            });
            throw new Error('Invalid range should fail');
        } catch (err) {
            // ignore, should happen
        }
    });
});
