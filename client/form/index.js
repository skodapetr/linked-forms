import {register} from "../app/register.js";
import FormView from "./form-view";

import {
  materialRenderers,
  materialCells,
} from "@jsonforms/material-renderers";
import {jsonformsReducer} from "@jsonforms/core";

register({
  "name": "form-view",
  // "reducer": ,
  "url": "/",
  "component": FormView,
});

register({
  "name": "jsonforms",
  "reducer": jsonformsReducer(),
  "reducer-initial": {
    "cells": materialCells,
    "renderers": materialRenderers,
  },
});
