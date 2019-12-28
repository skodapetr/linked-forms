import React from "react";
import {
  Button,
  TextField,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@material-ui/core";

import {
  materialRenderers,
  materialCells,
} from "@jsonforms/material-renderers";
import {
  JsonForms,
} from "@jsonforms/react";

import {loadLinkedForm} from "./../rdflib-loader";
import {createNewValue} from "./../form-model";
import {convert} from "./../form-to-jsonforms";

class _FormView extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      "iri": "https://linked.opendata.cz/resource/form/slovník.gov.cz/legislativní/sbírka/111/2009/pojem/orgán-veřejné-moci",
      "value": null,
      "schema": null,
      "uiSchema": null,
      "status": 0,
      "modalOpen": false,
      "valueAsText": "",
    };
    this.loadForm = this.loadForm.bind(this);
    this.openModalWithValue = this.openModalWithValue.bind(this);
    this.closeModal = this.closeModal.bind(this);
  }

  componentDidMount() {
  }

  render() {
    const {value, schema, uiSchema, valueAsText} = this.state;
    return (
      <div>
        <h1>Linked Form</h1>
        {this.state.status === 0 &&
        <div>
          <TextField
            value={this.state.iri}
            label="URI"
            fullWidth
            onChange={({value}) => this.setState({"iri": value})}
          />
          <br/>
          <br/>
          <Button
            onClick={this.loadForm}
            variant="contained" color="primary">
            Load dialog
          </Button>
        </div>
        }
        {this.state.status === 1 &&
        <div>
          <br/>
          Loading ...
          <br/>
          <br/>
          <LinearProgress variant="query"/>
        </div>
        }
        {this.state.status === 2 &&
        //  TODO
        //  The Label in JsonForms use 125% height, so we need to get
        //  get rid of this.
        <div style={{"overflowX": "hidden"}}>
          <JsonForms
            data={value}
            schema={schema}
            uischema={uiSchema}
            renderers={materialRenderers}
            cells={materialCells}
            onChange={({data}) => this.setState({"value": data})}
          />
          <br/>
          <br/>
          <div style={{"margin": "1rem 0 1rem 0"}}>
            <Button
              onClick={this.openModalWithValue}
              variant="contained" color="primary">
              Show data as JSON
            </Button>
          </div>
        </div>
        }
        <Dialog
          open={this.state.modalOpen}
          fullScreen
        >
          <DialogTitle>Value as JSON</DialogTitle>
          <DialogContent dividers>
            <pre>{valueAsText}</pre>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.closeModal} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    )
  }

  loadForm() {
    this.setState({
      "status": 1,
    });
    loadLinkedForm(this.state.iri)
      .then((form) => {
        const {schema, uiSchema} = convert(form);
        const newValue = createNewValue(form);
        this.setState({
          "value": newValue,
          "schema": schema,
          "uiSchema": uiSchema,
          "status": 2,
        });
      });
  }

  openModalWithValue() {
    this.setState({
      "valueAsText": JSON.stringify(this.state.value, null, 2),
      "modalOpen": true,
    });
  }

  closeModal() {
    this.setState({"modalOpen": false});
  }

}

export default _FormView;
