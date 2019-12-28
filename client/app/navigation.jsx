import React from "react";
import {App} from "./app";
import {Router, Route, Switch} from "react-router-dom";
import {getRegistered} from "./register";
import PageNotFound from "./page-not-found";

export const createRoutes = (history) => (
  <Router history={history}>
    <App>
      <Switch>
        {
          getRouteObjects().map(page =>
            <Route
              key={page.id}
              path={page.link}
              component={page.component}
              exact={page.exact}
            />,
          )
        }
        <Route path="*" component={PageNotFound}/>
      </Switch>
    </App>
  </Router>
);

function getRouteObjects() {
  const routes = [];
  getRegistered().forEach((entry) => {
    if (entry.url === undefined || entry.component === undefined) {
      return;
    }
    routes.push({
      "id": entry.name,
      "link": entry.url,
      "component": entry.component,
      "exact": false,
    });
  });
  return routes;
}
