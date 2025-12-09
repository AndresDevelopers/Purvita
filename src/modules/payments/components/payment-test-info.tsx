'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, CreditCard, Wallet } from 'lucide-react';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentTestInfoProps {
  provider: PaymentProvider;
}

const PAYPAL_TEST_INFO = {
  title: 'PayPal Testing Information',
  description: 'Use these test credentials and information for PayPal integration testing',
  environment: {
    sandbox: 'https://developer.paypal.com/developer/applications/',
    live: 'https://www.paypal.com/businessprofile/mytools/apiaccess'
  },
  testAccounts: [
    {
      type: 'Personal (Buyer)',
      email: 'sb-buyer@personal.example.com',
      password: 'Test1234'
    },
    {
      type: 'Business (Seller)',
      email: 'sb-seller@business.example.com',
      password: 'Test1234'
    }
  ],
  testCards: [
    {
      type: 'Visa',
      number: '4032035728926109',
      expiry: '01/2027',
      cvv: '123'
    },
    {
      type: 'Mastercard',
      number: '5425233430109903',
      expiry: '01/2027',
      cvv: '123'
    }
  ],
  tips: [
    'Use PayPal Sandbox environment for testing',
    'Create test accounts in PayPal Developer Dashboard',
    'Test both successful and failed payment scenarios',
    'Verify webhook notifications are received correctly',
    'Check transaction details in PayPal Sandbox dashboard'
  ]
};

const STRIPE_TEST_INFO = {
  title: 'Stripe Testing Information',
  description: 'Use these test cards and information for Stripe integration testing',
  environment: {
    test: 'https://dashboard.stripe.com/test',
    live: 'https://dashboard.stripe.com'
  },
  testCards: [
    {
      type: 'Visa (Success)',
      number: '4242424242424242',
      expiry: 'Any future date',
      cvv: 'Any 3 digits'
    },
    {
      type: 'Visa (Declined)',
      number: '4000000000000002',
      expiry: 'Any future date',
      cvv: 'Any 3 digits'
    },
    {
      type: 'Mastercard (Success)',
      number: '5555555555554444',
      expiry: 'Any future date',
      cvv: 'Any 3 digits'
    },
    {
      type: 'American Express',
      number: '378282246310005',
      expiry: 'Any future date',
      cvv: 'Any 4 digits'
    },
    {
      type: 'Insufficient Funds',
      number: '4000000000009995',
      expiry: 'Any future date',
      cvv: 'Any 3 digits'
    }
  ],
  tips: [
    'Use test mode API keys (pk_test_... and sk_test_...)',
    'Test different card scenarios (success, decline, etc.)',
    'Verify webhook endpoints receive events correctly',
    'Check payment details in Stripe Test Dashboard',
    'Test 3D Secure authentication with specific test cards'
  ]
};

export const PaymentTestInfo = ({ provider }: PaymentTestInfoProps) => {
  const info = provider === 'paypal' ? PAYPAL_TEST_INFO : STRIPE_TEST_INFO;
  const Icon = provider === 'paypal' ? Wallet : CreditCard;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {info.title}
          </CardTitle>
          <CardDescription>{info.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Environment Links */}
          <div>
            <h4 className="font-medium text-sm mb-2">Environment Dashboards:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(info.environment).map(([env, url]) => (
                <Badge key={env} variant="outline" className="cursor-pointer">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    {env.charAt(0).toUpperCase() + env.slice(1)}
                  </a>
                </Badge>
              ))}
            </div>
          </div>

          {/* Test Accounts (PayPal only) */}
          {provider === 'paypal' && 'testAccounts' in info && (
            <div>
              <h4 className="font-medium text-sm mb-2">Test Accounts:</h4>
              <div className="space-y-2">
                {info.testAccounts.map((account, index) => (
                  <div key={index} className="bg-muted p-3 rounded-lg text-sm">
                    <div className="font-medium">{account.type}</div>
                    <div className="text-muted-foreground">
                      Email: {account.email}<br />
                      Password: {account.password}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Cards */}
          <div>
            <h4 className="font-medium text-sm mb-2">Test Cards:</h4>
            <div className="space-y-2">
              {info.testCards.map((card, index) => (
                <div key={index} className="bg-muted p-3 rounded-lg text-sm">
                  <div className="font-medium">{card.type}</div>
                  <div className="text-muted-foreground">
                    Number: {card.number}<br />
                    Expiry: {card.expiry}<br />
                    CVV: {card.cvv}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testing Tips */}
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Testing Tips:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {info.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};