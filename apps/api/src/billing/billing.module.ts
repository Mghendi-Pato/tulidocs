import { Global, Module } from '@nestjs/common';
import { CheckoutService } from '../payments/checkout.service';
import { MpesaService } from '../payments/mpesa.service';
import { PaymentsController } from '../payments/payments.controller';
import { PaystackService } from '../payments/paystack.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Global()
@Module({
  controllers: [BillingController, PaymentsController],
  providers: [BillingService, CheckoutService, MpesaService, PaystackService],
  exports: [CheckoutService, BillingService],
})
export class BillingModule {}
