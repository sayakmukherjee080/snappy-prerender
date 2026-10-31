import '@warp-drive/ember/install';
import { setApplication } from '@ember/test-helpers';
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';
import Application from 'ember-test/app';
import config from 'ember-test/config/environment';
import * as QUnit from 'qunit';
import { setup } from 'qunit-dom';

export function start() {
  setApplication(Application.create(config.APP));

  setup(QUnit.assert);
  setupEmberOnerrorValidation();

  qunitStart();
}
