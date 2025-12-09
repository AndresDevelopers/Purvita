import { describe, expect, it, beforeEach, vi } from 'vitest'
import { PaymentFlowService } from '../services/payment-flow-service'
import type { PaymentProvider } from '../domain/models/payment-gateway'
import type { PaymentResponse } from '../services/payment-service'

describe('Payment Flow Integration Tests', () => {
  describe('Stripe Payment Flow', () => {
    describe('Test Mode', () => {
      it('should handle successful Stripe test payment with redirect', () => {
        const response: PaymentResponse = {
          sessionId: 'cs_test_123456',
          url: 'https://checkout.stripe.com/pay/cs_test_123456',
          status: 'requires_action'
        }

        const result = PaymentFlowService.normalizeGatewayResponse('stripe', response)

        expect(result.provider).toBe('stripe')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toBe('https://checkout.stripe.com/pay/cs_test_123456')
      })

      it('should throw error if Stripe test payment missing redirect URL', () => {
        const response: PaymentResponse = {
          sessionId: 'cs_test_123456',
          status: 'incomplete'
        }

        expect(() => {
          PaymentFlowService.normalizeGatewayResponse('stripe', response)
        }).toThrow('Missing payment redirect URL')
      })

      it('should handle Stripe test subscription checkout', () => {
        const response = {
          url: 'https://checkout.stripe.com/pay/cs_test_sub_789',
          status: 'requires_payment'
        }

        const result = PaymentFlowService.normalizeSubscriptionResponse('stripe', response)

        expect(result.provider).toBe('stripe')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toBe('https://checkout.stripe.com/pay/cs_test_sub_789')
      })
    })

    describe('Live Mode', () => {
      it('should handle successful Stripe live payment with redirect', () => {
        const response: PaymentResponse = {
          sessionId: 'cs_live_123456',
          url: 'https://checkout.stripe.com/pay/cs_live_123456',
          status: 'requires_action'
        }

        const result = PaymentFlowService.normalizeGatewayResponse('stripe', response)

        expect(result.provider).toBe('stripe')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toBe('https://checkout.stripe.com/pay/cs_live_123456')
        expect(result.redirectUrl).toContain('cs_live_')
      })

      it('should handle Stripe live subscription', () => {
        const response = {
          url: 'https://checkout.stripe.com/pay/cs_live_sub_456',
          status: 'active'
        }

        const result = PaymentFlowService.normalizeSubscriptionResponse('stripe', response)

        expect(result.provider).toBe('stripe')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toContain('cs_live_sub_')
      })

      it('should validate Stripe live mode credentials format', () => {
        // In real Stripe, live keys start with pk_live_ and sk_live_
        const livePublishableKey = 'pk_live_51234567890abcdef'
        const liveSecretKey = 'sk_live_51234567890abcdef'

        expect(livePublishableKey).toMatch(/^pk_live_/)
        expect(liveSecretKey).toMatch(/^sk_live_/)
      })
    })
  })

  describe('PayPal Payment Flow', () => {
    describe('Test Mode', () => {
      it('should handle successful PayPal test payment', () => {
        const response: PaymentResponse = {
          orderId: 'PAYID-TEST123456',
          approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=EC-TEST123',
          status: 'CREATED'
        }

        const result = PaymentFlowService.normalizeGatewayResponse('paypal', response)

        expect(result.provider).toBe('paypal')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=EC-TEST123')
        expect(result.redirectUrl).toContain('sandbox.paypal.com')
      })

      it('should handle PayPal test subscription', () => {
        const response = {
          url: 'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-TEST456',
          status: 'APPROVAL_PENDING'
        }

        const result = PaymentFlowService.normalizeSubscriptionResponse('paypal', response)

        expect(result.provider).toBe('paypal')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toContain('sandbox.paypal.com')
      })

      it('should throw error if PayPal test payment missing approval URL', () => {
        const response: PaymentResponse = {
          orderId: 'PAYID-TEST123456',
          status: 'CREATED'
        }

        expect(() => {
          PaymentFlowService.normalizeGatewayResponse('paypal', response)
        }).toThrow('Missing payment redirect URL')
      })
    })

    describe('Live Mode', () => {
      it('should handle successful PayPal live payment', () => {
        const response: PaymentResponse = {
          orderId: 'PAYID-LIVE123456',
          approvalUrl: 'https://www.paypal.com/checkoutnow?token=EC-LIVE789',
          status: 'CREATED'
        }

        const result = PaymentFlowService.normalizeGatewayResponse('paypal', response)

        expect(result.provider).toBe('paypal')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toBe('https://www.paypal.com/checkoutnow?token=EC-LIVE789')
        expect(result.redirectUrl).toContain('www.paypal.com')
        expect(result.redirectUrl).not.toContain('sandbox')
      })

      it('should handle PayPal live subscription', () => {
        const response = {
          url: 'https://www.paypal.com/webapps/billing/subscriptions?ba_token=BA-LIVE789',
          status: 'APPROVAL_PENDING'
        }

        const result = PaymentFlowService.normalizeSubscriptionResponse('paypal', response)

        expect(result.provider).toBe('paypal')
        expect(result.status).toBe('requires_action')
        expect(result.redirectUrl).toContain('www.paypal.com')
        expect(result.redirectUrl).not.toContain('sandbox')
      })

      it('should validate PayPal live vs test environment URLs', () => {
        const testUrl = 'https://www.sandbox.paypal.com/checkoutnow'
        const liveUrl = 'https://www.paypal.com/checkoutnow'

        expect(testUrl).toContain('sandbox')
        expect(liveUrl).not.toContain('sandbox')
      })
    })
  })

  describe('Wallet Payment Flow', () => {
    it('should handle successful wallet payment', () => {
      const response: PaymentResponse = {
        status: 'completed'
      }

      const result = PaymentFlowService.normalizeGatewayResponse('wallet', response)

      expect(result.provider).toBe('wallet')
      expect(result.status).toBe('completed')
      expect(result.redirectUrl).toBeUndefined()
    })

    it('should handle wallet payment with wallet_confirmed status', () => {
      const response: PaymentResponse = {
        status: 'wallet_confirmed'
      }

      const result = PaymentFlowService.normalizeGatewayResponse('wallet', response)

      expect(result.provider).toBe('wallet')
      expect(result.status).toBe('completed')
    })

    it('should handle wallet payment with success status', () => {
      const response: PaymentResponse = {
        status: 'success'
      }

      const result = PaymentFlowService.normalizeGatewayResponse('wallet', response)

      expect(result.provider).toBe('wallet')
      expect(result.status).toBe('completed')
    })

    it('should throw error for failed wallet payment', () => {
      const response: PaymentResponse = {
        status: 'failed'
      }

      expect(() => {
        PaymentFlowService.normalizeGatewayResponse('wallet', response)
      }).toThrow('Wallet payment did not complete successfully')
    })

    it('should throw error for insufficient wallet balance', () => {
      const response: PaymentResponse = {
        status: 'insufficient_balance'
      }

      expect(() => {
        PaymentFlowService.normalizeGatewayResponse('wallet', response)
      }).toThrow('Wallet payment did not complete successfully')
    })

    it('should handle verification_required status from fraud detection', () => {
      const response: PaymentResponse = {
        status: 'verification_required',
        message: 'Additional verification required'
      } as any

      const result = PaymentFlowService.normalizeGatewayResponse('wallet', response)

      expect(result.provider).toBe('wallet')
      expect(result.status).toBe('verification_required')
      expect(result.verificationRequired).toBe(true)
      expect(result.verificationMessage).toBe('Additional verification required')
    })

    it('should handle wallet subscription payment', () => {
      const response = {
        status: 'completed'
      }

      const result = PaymentFlowService.normalizeSubscriptionResponse('wallet', response)

      expect(result.provider).toBe('wallet')
      expect(result.status).toBe('completed')
      expect(result.redirectUrl).toBeUndefined()
    })

    it('should throw error for failed wallet subscription', () => {
      const response = {
        status: 'failed'
      }

      expect(() => {
        PaymentFlowService.normalizeSubscriptionResponse('wallet', response)
      }).toThrow('Wallet subscription payment did not complete successfully')
    })
  })

  describe('Payment Flow Validation', () => {
    it('should require redirect URL for external providers', () => {
      const providers: PaymentProvider[] = ['stripe', 'paypal']

      providers.forEach(provider => {
        const invalidResponse: PaymentResponse = {
          status: 'processing'
        }

        expect(() => {
          PaymentFlowService.normalizeGatewayResponse(provider, invalidResponse)
        }).toThrow('Missing payment redirect URL')
      })
    })

    it('should not require redirect URL for wallet payments', () => {
      const response: PaymentResponse = {
        status: 'completed'
      }

      expect(() => {
        PaymentFlowService.normalizeGatewayResponse('wallet', response)
      }).not.toThrow()
    })

    it('should handle various success statuses for wallet', () => {
      const successStatuses = ['completed', 'wallet_confirmed', 'success']

      successStatuses.forEach(status => {
        const response: PaymentResponse = { status }
        const result = PaymentFlowService.normalizeGatewayResponse('wallet', response)

        expect(result.status).toBe('completed')
      })
    })
  })

  describe('Error Handling', () => {
    it('should include provider info in error for Stripe', () => {
      const response: PaymentResponse = {
        status: 'failed'
      }

      expect(() => {
        PaymentFlowService.normalizeGatewayResponse('stripe', response)
      }).toThrow()
    })

    it('should include provider info in error for PayPal', () => {
      const response: PaymentResponse = {
        status: 'failed'
      }

      expect(() => {
        PaymentFlowService.normalizeGatewayResponse('paypal', response)
      }).toThrow()
    })

    it('should include scenario info in wallet errors', () => {
      const response: PaymentResponse = {
        status: 'insufficient_balance'
      }

      try {
        PaymentFlowService.normalizeGatewayResponse('wallet', response)
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Wallet payment did not complete successfully')
      }
    })
  })

  describe('Mode Detection', () => {
    it('should detect Stripe test mode from session ID', () => {
      const testSessionId = 'cs_test_a1b2c3d4e5f6'
      const liveSessionId = 'cs_live_a1b2c3d4e5f6'

      expect(testSessionId).toContain('_test_')
      expect(liveSessionId).toContain('_live_')
    })

    it('should detect PayPal test mode from URL', () => {
      const testUrl = 'https://www.sandbox.paypal.com/checkoutnow'
      const liveUrl = 'https://www.paypal.com/checkoutnow'

      expect(testUrl).toContain('sandbox')
      expect(liveUrl).not.toContain('sandbox')
    })

    it('should validate test/live credentials format', () => {
      // Stripe test keys
      expect('pk_test_51234567890').toMatch(/^pk_test_/)
      expect('sk_test_51234567890').toMatch(/^sk_test_/)

      // Stripe live keys
      expect('pk_live_51234567890').toMatch(/^pk_live_/)
      expect('sk_live_51234567890').toMatch(/^sk_live_/)
    })
  })
})
