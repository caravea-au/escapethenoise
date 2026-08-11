/**
 * dealer-geocode service
 *
 * Stock core service. The interesting logic lives in the controller
 * (`geocodeAddress`) and in src/utils/geocode-address.ts.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService(
  'api::dealer-geocode.dealer-geocode',
);
