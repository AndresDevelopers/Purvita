import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentResultPageProps {
  provider: PaymentProvider;
  success: boolean;
  copy: {
    successTitle: string;
    successDescription: string;
    successMessage: string;
    cancelTitle: string;
    cancelDescription: string;
    cancelMessage: string;
    backToSettings: string;
    tryAgain: string;
    testAnother: string;
  };
}

export const PaymentResultPage = ({ provider, success, copy }: PaymentResultPageProps) => {
  const testPath = `/admin/payments/test/${provider}`;
  
  const iconColor = success ? 'text-green-600' : 'text-orange-600';
  const bgColor = success ? 'bg-green-100' : 'bg-orange-100';
  const messageBg = success ? 'bg-green-50' : 'bg-orange-50';
  const messageTextColor = success ? 'text-green-800' : 'text-orange-800';
  const messageDescColor = success ? 'text-green-700' : 'text-orange-700';

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 ${bgColor} rounded-full flex items-center justify-center mb-4`}>
              {success ? (
                <CheckCircle className={`w-8 h-8 ${iconColor}`} />
              ) : (
                <XCircle className={`w-8 h-8 ${iconColor}`} />
              )}
            </div>
            <CardTitle className={`text-2xl ${iconColor}`}>
              {success ? copy.successTitle : copy.cancelTitle}
            </CardTitle>
            <CardDescription>
              {success ? copy.successDescription : copy.cancelDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`${messageBg} p-4 rounded-lg`}>
              <h4 className={`font-medium ${messageTextColor} mb-2`}>
                {success ? 'Test Payment Completed' : 'Payment Not Completed'}
              </h4>
              <p className={`text-sm ${messageDescColor}`}>
                {success ? copy.successMessage : copy.cancelMessage}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link href="/admin/pays" className="flex-1">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {copy.backToSettings}
                </Button>
              </Link>
              <Link href={testPath} className="flex-1">
                <Button className="w-full">
                  {success ? copy.testAnother : copy.tryAgain}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};