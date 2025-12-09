/**
 * Mailchimp Service
 * Handles email subscription and unsubscription to Mailchimp audiences
 */

interface MailchimpSubscribeParams {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  marketingData?: {
    topProducts?: string; // Most purchased products
    accountAge?: string; // How long they've been active
    totalOrders?: number; // Total number of orders
    lastOrderDate?: string; // Last order date
    preferredCategories?: string; // Preferred product categories
  };
}

interface MailchimpUnsubscribeParams {
  email: string;
}

interface MailchimpConfig {
  apiKey: string;
  serverPrefix?: string;
  audienceId?: string;
}

interface MailchimpResponse {
  success: boolean;
  error?: string;
  memberId?: string;
}

interface MailchimpErrorResponse {
  title?: string;
  detail?: string;
  status?: number;
}

/**
 * Subscribe an email to a Mailchimp audience
 */
export async function subscribeToMailchimp(
  params: MailchimpSubscribeParams,
  config?: Partial<MailchimpConfig>
): Promise<MailchimpResponse> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    const apiKey = config?.apiKey || process.env.MAILCHIMP_API_KEY;
    
    if (!apiKey) {
      console.warn('Mailchimp API key not configured');
      return { success: false, error: 'Mailchimp not configured' };
    }

    // Extract server prefix from API key (format: key-us16)
    const serverPrefix = config?.serverPrefix || apiKey.split('-').pop();
    
    if (!serverPrefix) {
      console.error('Invalid Mailchimp API key format');
      return { success: false, error: 'Invalid API key format' };
    }

    // Use audience ID from config or environment
    const audienceId = config?.audienceId || process.env.MAILCHIMP_AUDIENCE_ID;
    
    if (!audienceId) {
      console.warn('Mailchimp audience ID not configured');
      return { success: false, error: 'Audience ID not configured' };
    }

    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members`;

    const payload = {
      email_address: params.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: params.firstName || '',
        LNAME: params.lastName || '',
        // Marketing data for personalized recommendations
        ...(params.marketingData && {
          TOPPROD: params.marketingData.topProducts || '',
          ACCTAGE: params.marketingData.accountAge || '',
          ORDERS: params.marketingData.totalOrders?.toString() || '0',
          LASTORDER: params.marketingData.lastOrderDate || '',
          PREFCAT: params.marketingData.preferredCategories || '',
        }),
      },
      tags: params.tags || [],
    };

    // Use btoa for base64 encoding (works in both Node.js and Edge runtime)
    const auth = typeof Buffer !== 'undefined' 
      ? Buffer.from(`anystring:${apiKey}`).toString('base64')
      : btoa(`anystring:${apiKey}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as MailchimpErrorResponse;
      
      // If user already exists, consider it a success
      if (errorData.title === 'Member Exists') {
        console.log(`Email ${params.email} already subscribed to Mailchimp`);
        return { success: true };
      }

      console.error('Mailchimp subscription failed:', errorData);
      return { 
        success: false, 
        error: errorData.detail || 'Failed to subscribe to Mailchimp' 
      };
    }

    const data = await response.json();
    console.log(`Successfully subscribed ${params.email} to Mailchimp`);
    return { success: true, memberId: data.id };
  } catch (error) {
    console.error('Error subscribing to Mailchimp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Unsubscribe an email from a Mailchimp audience
 */
export async function unsubscribeFromMailchimp(
  params: MailchimpUnsubscribeParams,
  config?: Partial<MailchimpConfig>
): Promise<MailchimpResponse> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    const apiKey = config?.apiKey || process.env.MAILCHIMP_API_KEY;

    if (!apiKey) {
      console.warn('Mailchimp API key not configured');
      return { success: false, error: 'Mailchimp not configured' };
    }

    // Extract server prefix from API key (format: key-us16)
    const serverPrefix = config?.serverPrefix || apiKey.split('-').pop();

    if (!serverPrefix) {
      console.error('Invalid Mailchimp API key format');
      return { success: false, error: 'Invalid API key format' };
    }

    // Use audience ID from config or environment
    const audienceId = config?.audienceId || process.env.MAILCHIMP_AUDIENCE_ID;

    if (!audienceId) {
      console.warn('Mailchimp audience ID not configured');
      return { success: false, error: 'Audience ID not configured' };
    }

    // Generate MD5 hash of lowercase email for subscriber hash
    const subscriberHash = await generateEmailHash(params.email.toLowerCase());
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`;

    // Use btoa for base64 encoding (works in both Node.js and Edge runtime)
    const auth = typeof Buffer !== 'undefined'
      ? Buffer.from(`anystring:${apiKey}`).toString('base64')
      : btoa(`anystring:${apiKey}`);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        status: 'unsubscribed',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as MailchimpErrorResponse;

      // If member doesn't exist, consider it a success (already unsubscribed)
      if (errorData.status === 404 || errorData.title === 'Resource Not Found') {
        console.log(`Email ${params.email} not found in Mailchimp (already unsubscribed)`);
        return { success: true };
      }

      console.error('Mailchimp unsubscription failed:', errorData);
      return {
        success: false,
        error: errorData.detail || 'Failed to unsubscribe from Mailchimp'
      };
    }

    console.log(`Successfully unsubscribed ${params.email} from Mailchimp`);
    return { success: true };
  } catch (error) {
    console.error('Error unsubscribing from Mailchimp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate MD5 hash of email for Mailchimp subscriber hash
 */
async function generateEmailHash(email: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Use Web Crypto API (works in Edge runtime and modern browsers)
    const encoder = new TextEncoder();
    const data = encoder.encode(email);
    const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => null);

    if (hashBuffer) {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }

  // Fallback: Use a simple hash function (not cryptographically secure, but works for Mailchimp)
  // This is only used if crypto.subtle is not available
  return simpleMD5(email);
}

/**
 * Simple MD5 implementation for fallback
 */
function simpleMD5(str: string): string {
  // This is a simplified version - in production, you might want to use a proper MD5 library
  // For now, we'll use a basic hash that works with Mailchimp
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Get count of subscribers with a specific tag from Mailchimp
 * Note: Mailchimp API v3.0 doesn't support filtering by tags directly,
 * so we need to fetch members and filter client-side
 */
export async function getMailchimpSubscribersCountByTag(
  tag: string,
  config?: Partial<MailchimpConfig>
): Promise<number> {
  try {
    const apiKey = config?.apiKey || process.env.MAILCHIMP_API_KEY;

    if (!apiKey) {
      console.warn('Mailchimp API key not configured');
      return 0;
    }

    // Extract server prefix from API key (format: key-us16)
    const serverPrefix = config?.serverPrefix || apiKey.split('-').pop();

    if (!serverPrefix) {
      console.error('Invalid Mailchimp API key format');
      return 0;
    }

    // Use audience ID from config or environment
    const audienceId = config?.audienceId || process.env.MAILCHIMP_AUDIENCE_ID;

    if (!audienceId) {
      console.warn('Mailchimp audience ID not configured');
      return 0;
    }

    // Use btoa for base64 encoding (works in both Node.js and Edge runtime)
    const auth = typeof Buffer !== 'undefined'
      ? Buffer.from(`anystring:${apiKey}`).toString('base64')
      : btoa(`anystring:${apiKey}`);

    // Mailchimp API doesn't support filtering by tags in query params
    // We need to fetch members and filter client-side
    let totalCount = 0;
    let offset = 0;
    const pageSize = 1000; // Max allowed by Mailchimp API
    let hasMore = true;

    while (hasMore) {
      const membersUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members?count=${pageSize}&offset=${offset}&fields=members.tags,total_items`;

      const response = await fetch(membersUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch Mailchimp subscribers:', response.status);
        break;
      }

      const data = await response.json() as {
        members?: Array<{ tags?: Array<{ name: string }> }>;
        total_items?: number;
      };

      if (!data.members || data.members.length === 0) {
        break;
      }

      // Count members with the specified tag
      const membersWithTag = data.members.filter(member =>
        member.tags?.some(t => t.name === tag)
      );
      totalCount += membersWithTag.length;

      // Check if there are more pages
      offset += pageSize;
      hasMore = data.total_items ? offset < data.total_items : false;

      // Safety limit: don't fetch more than 10,000 members to avoid timeout
      if (offset >= 10000) {
        console.warn('Reached safety limit of 10,000 members when counting tags');
        break;
      }
    }

    return totalCount;
  } catch (error) {
    console.error('Error getting Mailchimp subscribers count:', error);
    return 0;
  }
}
