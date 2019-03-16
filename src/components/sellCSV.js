import React, { Component } from 'react';
import { CSVLink, CSVDownload } from "react-csv";
import { Button } from 'react-bootstrap';
import _ from 'lodash';

class SellCSV extends Component {
  constructor(props) {
    super(props);
    this.state = {data: [], rentalFileLists: [], referenceData: [], results: []};
  }

  csvToObj(csv) {
    if (_.isNil(csv)) {
      return;
    }

    csv = csv.trim();
    var lines = csv.split('\r');
    var result = [];
    var headers = lines[0].split(',');
    headers = headers.map(function(h) {
      return h.trim().replace(/"/g, '');
    });

    for(var i=1; i<lines.length; i++) {
      var obj = {};
      var currentline = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      for(var j=0; j<headers.length; j++){
        obj[headers[j]] = currentline[j].trim().replace(/['"]+/g, '');
      }
      result.push(obj);
    }
    return result;
  }

  convertToNumber(v) {
    if (_.isNil(v)) {
      return;
    }
    return _.toNumber(v.replace(/\$|,/g, ""));
  }

  cleanup = () => {
    this.setState({data: [], rentalFileLists: [], referenceData: [], results: []});
  }

  financeCost = (row) => {
    if (_.isNil(_.get(row, 'Current Price'))) {
      return;
    }
    row.financeCost = _.round(this.convertToNumber(_.get(row, 'Current Price')) / 1000 * 6, 2);
    return row;
  }

  monthlyTax = (row) => {
    if (_.isNil(_.get(row, 'Tax Annual Amount'))) {
      return;
    }
    row.monthlyTax = _.round(this.convertToNumber(_.get(row, 'Tax Annual Amount')) / 12, 2);
    return row;
  }

  totalCost = (row) => {
    if (_.isNil(_.get(row, 'Condo/Coop Fee'))) {
      return;
    }
    const condoFee = this.convertToNumber(_.get(row, 'Condo/Coop Fee'));
    row.totalCost =  _.round(_.get(row, 'financeCost') + _.get(row, 'monthlyTax') + condoFee);
    return row;
  }

  rentalAvgIncome = (row) => {
    const currentSQFT = this.convertToNumber(_.get(row, 'Total SQFT'));
    const currentBed = this.convertToNumber(_.get(row, 'Beds'));
    const currentSubdivision = _.get(row, 'Subdivision/Neighborhood');
    if (_.isNil(currentSQFT)) {
      return;
    }
    const data = this.state.referenceData;
    let qualifiedSQFTs = _.filter(data, (o, i) => {
      const sqft = this.convertToNumber(_.get(data[i], 'Total SQFT'));
      const bed = this.convertToNumber(_.get(data[i], 'Beds'));
      const subdivision = _.get(data[i], 'Subdivision/Neighborhood');
      return (_.isEqual(currentSubdivision, subdivision) && _.isEqual(currentBed, bed) && (sqft > currentSQFT - 200 && sqft < currentSQFT + 200));
    });
    const sumPrice = _.sumBy(qualifiedSQFTs, (o) => {
      return this.convertToNumber(_.get(o, 'Current Price'));
    });
    row.rentalAvgIncome = _.round(sumPrice / qualifiedSQFTs.length, 2);
    return row;
  }

  returnRate = (row) => {
    row.returnRate = _.round(_.get(row, 'rentalAvgIncome') / _.get(row, 'totalCost'), 2);
    return row;
  }

  nominalAmount = (row) => {
    row.nominalAmount = _.round(_.get(row, 'rentalAvgIncome') - _.get(row, 'totalCost'), 2);
    return row;
  }

  getCSV = () => {
    const data = this.state.data;
    if (data === null) return;
    let results = [];
    results = _.map(data, this.financeCost);
    results = _.map(results, this.monthlyTax);
    results = _.map(results, this.totalCost);
    results = _.map(results, this.rentalAvgIncome);
    results = _.map(results, this.returnRate);
    results = _.map(results, this.nominalAmount);
    this.setState({results: results});
  }

  handleSellData = (e) => {
    let reader = new FileReader();
    const that = this;
    reader.onload = (e) => {
      const obj = that.csvToObj(e.target.result);
      this.setState({data: obj});
    }
    reader.readAsText(e.target.files[0]);
  }

  handleReferenceData = (e) => {
    const that = this;
    let files = _.get(e, 'target.files');
    for (let i = 0; i < files.length; i++) {
      let reader = new FileReader();
      reader.onload = (e) => {
        const obj = that.csvToObj(e.target.result);
        this.setState({referenceData: [...this.state.referenceData, ...obj]});
      }
      reader.readAsText(e.target.files[i]);
    }

  }

  render() {
    return (
      <div>
        <div>Upload Sell CSV for Calculation</div>
        <input
          type="file"
          placeholder='Upload Sell CSV...'
          onChange={this.handleSellData}
        />
        <div>Upload Rental CSV as Reference Data</div>
        <div>
          <Button
            as="input"
            type="file"
            placeholder='Upload Rental CSV...'
            onChange={this.handleReferenceData}
            multiple
          />
        </div>
        <Button variant="info" onClick={this.getCSV}>Generate Result</Button>
        {
          this.state.results.length > 0 &&
          <CSVLink
            data={this.state.results}
            filename='sell.csv'
            onClick={this.cleanup}
          >
          Export Sell CSV File
          </CSVLink>
        }
      </div>
    );
  }
}

export { SellCSV as default };
