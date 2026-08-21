/**
 * dealer-enquiry routes
 *
 * Deliberately NOT `factories.createCoreRouter`: dealer-enquiry stores
 * consumer PII (name, email, phone, message). A core router would also wire
 * up find/findOne/update/delete, and a single future permissions tick on the
 * Public role would expose every consumer's private details. Only `create`
 * is ever reachable, and only via this one route.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/dealer-enquiries',
      handler: 'dealer-enquiry.create',
      config: {
        auth: false,
      },
    },
  ],
};
