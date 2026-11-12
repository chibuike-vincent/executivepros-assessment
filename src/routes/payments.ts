import { Router } from 'express';
import { createPaymentController } from '../controllers/payment-controller';
import type { PaymentService } from '../services/payment-service';

export function createPaymentRouter(paymentService: PaymentService): Router {
  const router = Router();
  const controller = createPaymentController(paymentService);

  router.post('/', (req, res, next) => {
    void controller.create(req, res).catch(next);
  });
  router.get('/', (req, res, next) => {
    void controller.list(req, res).catch(next);
  });
  router.get('/:id', (req, res, next) => {
    void controller.getById(req, res).catch(next);
  });
  router.patch('/:id', (req, res, next) => {
    void controller.updateStatus(req, res).catch(next);
  });
  router.put('/:id', (req, res, next) => {
    void controller.updateStatus(req, res).catch(next);
  });

  return router;
}
