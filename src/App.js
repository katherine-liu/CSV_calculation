import React, { Component } from 'react';
import { Container } from 'react-bootstrap';
import './App.css';
import SellCSV from './components/sellCSV';
import CsvCalculator from './components/CsvCalculator';

class App extends Component {
  render() {
    return (
      <div className="App">
      <Container>
        <CsvCalculator />
      </Container>
      </div>
    );
  }
}

export default App;
