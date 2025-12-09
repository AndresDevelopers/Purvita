import { z } from 'zod';
import { PaymentProviderSchema } from '@/modules/payments/domain/models/payment-gateway';

export const MemberSubscriptionStatusSchema = z.object({
  isActive: z.boolean(),
  provider: PaymentProviderSchema.nullable(),
  lastPaymentAt: z.string().datetime().nullable(),
  activeSince: z.string().datetime().nullable(),
});

export type MemberSubscriptionStatus = z.infer<typeof MemberSubscriptionStatusSchema>;

export type MemberNode = {
  memberId: string;
  name: string;
  subscription: MemberSubscriptionStatus;
  recruits: MemberNode[];
};

export const MemberNodeSchema: any = z.lazy(() =>
  z.object({
    memberId: z.string().uuid(),
    name: z.string().min(1),
    subscription: MemberSubscriptionStatusSchema,
    recruits: z.array(MemberNodeSchema),
  }),
);

export const MemberNetworkSnapshotSchema = z.object({
  owner: MemberNodeSchema,
  directRecruits: z.array(MemberNodeSchema),
});

export type MemberNetworkSnapshot = z.infer<typeof MemberNetworkSnapshotSchema>;

export const computeActiveCounts = (network: MemberNetworkSnapshot) => {
  const directActiveMembers = network.directRecruits.filter((recruit) => recruit.subscription.isActive).length;
  const secondLevelActiveMembers = network.directRecruits
    .flatMap((recruit) => recruit.recruits)
    .filter((node) => node.subscription.isActive).length;
  const totalActiveMembers = [
    network.owner,
    ...network.directRecruits,
    ...network.directRecruits.flatMap((recruit) => recruit.recruits),
  ].filter((node) => node.subscription.isActive).length;

  return {
    totalActiveMembers,
    directActiveMembers,
    secondLevelActiveMembers,
  };
};
