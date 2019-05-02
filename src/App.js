import React, { Component } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import './App.css';
import SellCSV from './components/sellCSV';

class App extends Component {
  render() {
    return (
      <div className="App">
      <Container>
        <SellCSV />
      </Container>
      </div>
    );
  }
}

export default App;
