import React, {useState, useEffect} from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { CSVLink } from "react-csv";
import isNil from 'lodash/isNil';
import get from 'lodash/get';
import map from 'lodash/map';
import toNumber from 'lodash/toNumber';
import round from 'lodash/round';
import floor from 'lodash/floor';
import isEqual from 'lodash/isEqual';
import forEach from 'lodash/forEach';

const CsvCalculator = () => {
  const [downpayPercentage, setDownpayPercentage] = useState(20);
  const [appreciationRate, setAppreciationRate] = useState(0.03);
  const [interestRate, setInterestRate] = useState(4.5);
  const [mortgagePeriod, setMortgagePeriod] = useState(30);
  const [ratioPerThousand, setRatioPerThousand] = useState(5.07);
  const [adjustedSQFT, setAdjustedSQFT] = useState(200);
  const [results, setResults] = useState([]);
  const [sellData, setSellData] = useState([]);
  const [referenceData, setReferenceData] = useState([]);

  const csvToObj = (csv) => {
    if (isNil(csv)) {
      return;
    }

    csv = csv.trim();
    const lines = csv.split('\r');
    let headers = lines[0].split(',');
    headers = headers.map(function(h) {
      return h.trim().replace(/"/g, '');
    });
    let result = [];

    for(var i = 1; i < lines.length; i++) {
      let obj = {};
      const currentline = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      for(var j = 0; j < headers.length; j++){
        obj[headers[j]] = currentline[j].trim().replace(/['"]+/g, '');
      }
      result.push(obj);
    }
    return result;
  };

  const handleSellData = (e) => {
    let reader = new FileReader();
    reader.onload = (e) => {
      const obj = csvToObj(get(e, 'target.result'));
      setSellData(obj);
    }
    reader.readAsText(get(e, 'target.files[0]'));
  };

  const handleReferenceData = (e) => {
    let files = get(e, 'target.files');
    for (let i = 0; i < files.length; i++) {
      let reader = new FileReader();
      reader.onload = (e) => {
        const obj = csvToObj(e.target.result);
        setReferenceData(obj);
      }
      reader.readAsText(e.target.files[i]);
    }
  };

  const purifyNumber = n => {
    if (isNil(n)) {
      return 0;
    }
    return toNumber(n.toString().replace(/\$|,/g, ""));
  }

  const getMonthlyPayment = (downpayPercentage, principal, apr, mortgagePeriod) => {
    const i = apr / 1200;
    const n = mortgagePeriod * 12;
    return round(principal * (1 - downpayPercentage / 100) * (i * Math.pow((1 + i), n)) / (Math.pow((1 + i), n) - 1), 2);
  };

  const getPaymentDetails = (loadAmount, apr, period, paymentTime) => {
    const monthlyInterest = apr / 1200;
    const monthlyPayment = getMonthlyPayment(downpayPercentage, loadAmount, apr, period);

    let totalInterst = 0;
    let totalPrincipal = 0;
    let principalBalance = floor(loadAmount * (1 - downpayPercentage / 100), 2);

    for (let i = 0; i < paymentTime; i++) {
      const currentInterest = floor(principalBalance * monthlyInterest, 2);
      const currentPrincipal = floor(monthlyPayment - currentInterest, 2);
      totalInterst += currentInterest;
      totalPrincipal += currentPrincipal;
      principalBalance -= currentPrincipal;
    }
    return {
      totalInterst,
      totalPrincipal,
    };
  };

  const pi = row => {
    const currentPrice = purifyNumber(get(row, 'Current Price', 0));
    row.pi = getMonthlyPayment(downpayPercentage, currentPrice, interestRate, mortgagePeriod);
    return row;
  };
  const monthlyTax = row => {
    const taxAnnualAmount = purifyNumber(get(row, 'Tax Annual Amount', 0));
    row.monthlyTax = round(taxAnnualAmount / 12, 2);
    return row;
  };
  const hoaCondoFeeMonthlyTax = row => {
    row.hoaCondoFeeMonthlyTax = get(row, 'monthlyTax', 0) +
    purifyNumber(get(row, 'Condo/Coop Fee', 0)) +
    purifyNumber(get(row, 'HOA Fee', 0));
    return row;
  };
  const totalCost = row => {
    row.totalCost = round(get(row, 'pi', 0) + get(row, 'hoaCondoFeeMonthlyTax', 0));
    return row;
  };
  const monthlyRentalAvgIncome = row => {
    const currentSQFT = purifyNumber(get(row, 'Above Grade Finished SQFT', 0));
    const currentBed = purifyNumber(get(row, 'Beds'), 0);
    const currentSubdivision = get(row, 'Legal Subdivision', get(row, 'Subdivision/Neighborhood', null));

    let totalRental = 0;
    let qulifiedAmount = 0;

    forEach(referenceData, rentalProperty => {
      const sqft = purifyNumber(get(rentalProperty, 'Above Grade Finished SQFT', 0));
      const bed = purifyNumber(get(rentalProperty, 'Beds', 0));
      const subdivision = get(rentalProperty, 'Legal Subdivision', get(rentalProperty, 'Subdivision/Neighborhood', null));

      if (isEqual(bed, currentBed) &&
        isEqual(subdivision, currentSubdivision) &&
        sqft >= currentSQFT - adjustedSQFT &&
        sqft <= currentSQFT + adjustedSQFT) {
          totalRental += purifyNumber(get(rentalProperty, 'Current Price', 0));
          qulifiedAmount++;
        }
    });
    row.monthlyRentalAvgIncome = qulifiedAmount === 0 ? 'No matching' : round(totalRental / qulifiedAmount, 2);
    return row;
  };
  const monthlyReturnRate = row => {
    row.monthlyReturnRate = round(get(row, 'monthlyRentalAvgIncome', 0) / get(row, 'totalCost', 1), 2);
    return row;
  };
  const nominalAmount = row => {
    const monthlyRentalAvgIncome = get(row, 'monthlyRentalAvgIncome', 0);
    const totalCost = get(row, 'totalCost', 0);
    row.nominalAmount = round(monthlyRentalAvgIncome - totalCost, 2);
    return row;
  };
  const ratio = row => {
    const taxAssessedValue = purifyNumber(get(row, 'Tax Assessed Value', 0));
    const currentPrice = purifyNumber(get(row, 'Current Price', 1));
    row.ratio = round(taxAssessedValue / currentPrice, 2);
    return row;
  };
  const depreciation = row => {
    const currentPrice = purifyNumber(get(row, 'Current Price', 0));
    row.depreciation = round(currentPrice / 27.5, 2);
    return row;
  };
  const appreciation = row => {
    const currentPrice = purifyNumber(get(row, 'Current Price', 0));
    row.appreciation = round(currentPrice * appreciationRate, 2);
    return row;
  };
  const totalReturnPerYear = row => {
    const paymentDetails = getPaymentDetails(purifyNumber(get(row, 'Current Price', 0)), interestRate, mortgagePeriod, 12);
    row.totalReturnPerYear = get(paymentDetails, 'totalPrincipal', 0) + get(row, 'nominalAmount', 0) * 12 + get(row, 'appreciation', 0) + get(row, 'depreciation', 0);
    return row;
  };
  const monthlyTotalReturn = row => {
    row.monthlyTotalReturn = get(row, 'totalReturnPerYear', 0) / 12;
    return row;
  };
  const firstYearTotalReturnOverCurrentPrice = row => {
    row.firstYearTotalReturnOverCurrentPrice = get(row, 'totalReturnPerYear', 0) / (purifyNumber(get(row, 'Current Price', 0)));
    return row;
  };

  const getCSV = () => {
    if (isNil(sellData)) {
      return;
    }
    let res = [];
    res = map(sellData, pi);
    res = map(res, monthlyTax);
    res = map(res, hoaCondoFeeMonthlyTax);
    res = map(res, totalCost);
    res = map(res, monthlyRentalAvgIncome);
    res = map(res, monthlyReturnRate);
    res = map(res, nominalAmount);
    res = map(res, ratio);
    res = map(res, depreciation);
    res = map(res, appreciation);
    res = map(res, totalReturnPerYear);
    res = map(res, monthlyTotalReturn);
    res = map(res, firstYearTotalReturnOverCurrentPrice);

    setResults(res);
  };

  const cleanup = () => {
    setResults([]);
    setSellData([]);
    setReferenceData([]);
  };

  useEffect(() => {
    setRatioPerThousand(getMonthlyPayment(0, 1000, interestRate, mortgagePeriod));
  }, [interestRate, mortgagePeriod]);

  return (
    <Form>
      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Downpayment Percentage (default is 20):
        </Form.Label>
        <Col sm="9">
          <Form.Control name="downpayPercentage" type="number" value={downpayPercentage} onChange={setDownpayPercentage} />
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Input Interest Rate (default is 4.5):
        </Form.Label>
        <Col sm="9">
          <Form.Control name="interestRate" type="number" value={interestRate} onChange={setInterestRate} />
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Input Ratio per 1000:
        </Form.Label>
        <Col sm="9">
          <Form.Control name="ratioPerThousand" plaintext readOnly value={ratioPerThousand}/>
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          mortgage Period:
        </Form.Label>
        <Col sm="9">
          <Form.Control name="mortgagePeriod" type="number" value={mortgagePeriod} onChange={setMortgagePeriod}/>
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Appreciation Rate (default is 0.03)
        </Form.Label>
        <Col sm="9">
          <Form.Control name="ratioPerThousand" type="number" value={appreciationRate} onChange={setAppreciationRate}/>
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Input Adjusted SQFT:
        </Form.Label>
        <Col sm="9">
          <Form.Control name="adjustedSQFT" type="number" value={adjustedSQFT} onChange={setAdjustedSQFT}/>
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Upload Sell CSV:
        </Form.Label>
        <Col sm="9">
          <input
            type="file"
            placeholder='Upload Sell CSV...'
            onChange={handleSellData}
          />
        </Col>
      </Form.Group>

      <Form.Group as={Row}>
        <Form.Label column sm="3">
          Upload Rental CSV:
        </Form.Label>
        <Col sm="9">
          <input
            type="file"
            placeholder='Upload Rental CSV...'
            onChange={handleReferenceData}
            multiple
          />
        </Col>
      </Form.Group>

      <Row>
      <Col sm="2">
        <Button variant="info" onClick={getCSV}>Generate Result</Button>
      </Col>
      <Col sm="3">
        {
          results.length > 0 &&
          <CSVLink
            className="btn btn-success"
            data={results}
            filename="sell.csv"
            onClick={cleanup}
          >
            Export Sell CSV File
          </CSVLink>
        }
      </Col>
      </Row>
    </Form>
  );
};

export default CsvCalculator;
