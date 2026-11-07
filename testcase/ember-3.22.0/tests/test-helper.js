import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';
import Application from 'ember322-test/app';
import config from 'ember322-test/config/environment';

setApplication(Application.create(config.APP));

start();
