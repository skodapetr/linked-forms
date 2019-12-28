import React from "react";
import ReactDOM from "react-dom";
import {createBrowserHistory} from "history";
import {Provider} from "react-redux";
import {ConnectedRouter} from "connected-react-router"
import {createStore} from "./app/store";
import {createRoutes} from "./app/navigation";

import "./modules";

const history = createBrowserHistory();
const store = createStore(history);

ReactDOM.render((
  <Provider store={store}>
    <ConnectedRouter history={history}>
      {createRoutes(history)}
    </ConnectedRouter>
  </Provider>
), document.getElementById("app"));
