import React from "react";
import {withRouter} from "react-router";
import {hot} from "react-hot-loader";
import {connect} from "react-redux";
import Header from "./header";
import Footer from "./footer";
import {PropTypes} from "prop-types";
// import Container from "@material-ui/core/Container";
// import CssBaseline from "@material-ui/core/CssBaseline";

class AppComponent extends React.Component {
  render() {
    return (
      <div>
        {/*<CssBaseline/>*/}
        <Header/>
        {/*<Container>*/}
        {React.cloneElement(this.props.children, this.props)}
        {/*</Container>*/}
        <Footer/>
      </div>
    );
  }
}

AppComponent.propTypes = {
  "children": PropTypes.node.isRequired,
};

export const App = hot(module)(withRouter(connect()(AppComponent)));

