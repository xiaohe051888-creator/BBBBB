type ServiceWorkerNavigator = Pick<Navigator, 'serviceWorker'>;

type RegisterOptions = {
  isProduction?: boolean;
  navigatorRef?: ServiceWorkerNavigator;
  onError?: (error: unknown) => void;
};

export async function registerServiceWorker({
  isProduction = import.meta.env.PROD,
  navigatorRef = navigator as ServiceWorkerNavigator,
  onError = () => undefined,
}: RegisterOptions = {}): Promise<void> {
  if (!isProduction) {
    return;
  }

  if (!('serviceWorker' in navigatorRef)) {
    return;
  }

  try {
    await navigatorRef.serviceWorker.register('/sw.js');
  } catch (error) {
    onError(error);
  }
}
