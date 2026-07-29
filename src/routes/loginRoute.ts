import { Router } from 'express';
import { loginHandler } from '../controllers/loginController';

const router = Router();

router.post('/', loginHandler);

export { router as loginRouter };
