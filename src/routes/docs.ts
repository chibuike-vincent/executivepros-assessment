import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '../docs/openapi';

export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  router.use('/', swaggerUi.serve);
  router.get(
    '/',
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Payment Processing API',
      swaggerOptions: {
        persistAuthorization: false,
      },
    }),
  );

  return router;
}
