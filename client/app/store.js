import {combineReducers} from "redux";
import {connectRouter, routerMiddleware} from "connected-react-router";
import {getRegistered} from "./register";
import {createStore as createReduxStore, compose, applyMiddleware} from "redux";
import thunk from "redux-thunk";

export function createStore(history) {
  const {reducer, initialState} = prepareReducer(history);
  const enhancer = prepareEnhancer(history);
  return createReduxStore(reducer, initialState, enhancer);
}

function prepareReducer(history) {
  const reducers = {
    "router": connectRouter(history),
  };
  const initialState = {};
  addRegisteredReducers(reducers, initialState);
  return {
    "reducer": combineReducers(reducers),
    "initialState": initialState,
  };
}

function addRegisteredReducers(reducers, initialState) {
  getRegistered().forEach((entry) => {
    if (entry["reducer"] === undefined) {
      return;
    }
    reducers[entry["name"]] = entry["reducer"];
    if (entry["reducer-initial"]) {
      initialState[entry["name"]] = entry["reducer-initial"];
    }
  });
}

function prepareEnhancer(history) {
  const composeEnhancers = getComposeMethod();
  return composeEnhancers(
    applyMiddleware(routerMiddleware(history), thunk),
  );
}

function getComposeMethod() {
  return window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
}
