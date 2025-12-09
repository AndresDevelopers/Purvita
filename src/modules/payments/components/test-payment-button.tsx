import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import { PaymentTestModal } from './payment-test-modal';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import type { SubscriptionTestInfo } from '../domain/models/subscription-test-info';

interface TestPaymentButtonProps {
  provider: PaymentProvider;
  disabled?: boolean;
  className?: string;
  subscriptionTestInfo?: SubscriptionTestInfo;
}

export const TestPaymentButton = ({
  provider,
  disabled = false,
  className,
  subscriptionTestInfo,
}: TestPaymentButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled={disabled}
        onClick={handleOpenModal}
      >
        <CreditCard className="w-4 h-4 mr-2" />
        Probar Pago
      </Button>
      
      {isModalOpen && (
        <PaymentTestModal
          provider={provider}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          subscriptionTestInfo={subscriptionTestInfo}
        />
      )}
    </>
  );
};