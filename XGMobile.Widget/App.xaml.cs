using System;
using System.Threading.Tasks;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.ApplicationModel.AppService;
using Windows.ApplicationModel.Background;
using Windows.Foundation.Collections;
using Windows.Foundation.Metadata;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Microsoft.Gaming.XboxGameBar;

namespace XGMobile.Widget
{
    sealed partial class App : Application
    {
        public static AppServiceConnection HelperConnection { get; private set; }
        public static BackgroundTaskDeferral AppServiceDeferral { get; private set; }

        public static event EventHandler HelperConnected;
        public static event EventHandler HelperDisconnected;
        public static event EventHandler<ValueSet> HelperEventReceived;

        private XboxGameBarWidget _gameBarWidget;

        public App()
        {
            InitializeComponent();
        }

        public static async Task EnsureFullTrustHelperLaunchedAsync()
        {
            if (HelperConnection != null)
            {
                return;
            }

            if (ApiInformation.IsApiContractPresent("Windows.ApplicationModel.FullTrustAppContract", 1, 0))
            {
                await FullTrustProcessLauncher.LaunchFullTrustProcessForCurrentAppAsync();
            }
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            Frame rootFrame = Window.Current.Content as Frame;
            if (rootFrame == null)
            {
                rootFrame = new Frame();
                Window.Current.Content = rootFrame;
            }

            if (rootFrame.Content == null)
            {
                rootFrame.Navigate(typeof(MainPage));
            }

            Window.Current.Activate();
        }

        protected override void OnActivated(IActivatedEventArgs args)
        {
            XboxGameBarWidgetActivatedEventArgs widgetArgs = null;
            if (args.Kind == ActivationKind.Protocol)
            {
                IProtocolActivatedEventArgs protocolArgs = args as IProtocolActivatedEventArgs;
                if (protocolArgs != null &&
                    protocolArgs.Uri.Scheme.Equals("ms-gamebarwidget", StringComparison.OrdinalIgnoreCase))
                {
                    widgetArgs = args as XboxGameBarWidgetActivatedEventArgs;
                }
            }

            if (widgetArgs != null && widgetArgs.IsLaunchActivation)
            {
                Frame rootFrame = new Frame();
                Window.Current.Content = rootFrame;

                _gameBarWidget = new XboxGameBarWidget(widgetArgs, Window.Current.CoreWindow, rootFrame);
                rootFrame.Navigate(typeof(MainPage), _gameBarWidget);

                Window.Current.Closed += (s, ev) => { _gameBarWidget = null; };
                Window.Current.Activate();
            }
        }

        protected override void OnBackgroundActivated(BackgroundActivatedEventArgs args)
        {
            base.OnBackgroundActivated(args);

            IBackgroundTaskInstance taskInstance = args.TaskInstance;
            AppServiceTriggerDetails appService = taskInstance.TriggerDetails as AppServiceTriggerDetails;
            if (appService == null)
            {
                return;
            }

            if (!string.Equals(appService.Name, "XGMobile.AppService", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            AppServiceDeferral = taskInstance.GetDeferral();
            taskInstance.Canceled += OnAppServicesCanceled;

            HelperConnection = appService.AppServiceConnection;
            HelperConnection.RequestReceived += OnAppServiceRequestReceived;
            HelperConnection.ServiceClosed += OnAppServiceClosed;

            EventHandler connectedHandler = HelperConnected;
            if (connectedHandler != null)
            {
                connectedHandler(this, EventArgs.Empty);
            }
        }

        private async void OnAppServiceRequestReceived(AppServiceConnection sender, AppServiceRequestReceivedEventArgs args)
        {
            AppServiceDeferral messageDeferral = args.GetDeferral();
            try
            {
                ValueSet message = args.Request.Message;
                EventHandler<ValueSet> handler = HelperEventReceived;
                if (handler != null)
                {
                    handler(this, message);
                }

                ValueSet ack = new ValueSet
                {
                    { "Ack", true }
                };
                await args.Request.SendResponseAsync(ack);
            }
            finally
            {
                messageDeferral.Complete();
            }
        }

        private void OnAppServiceClosed(AppServiceConnection sender, AppServiceClosedEventArgs args)
        {
            CleanupConnection();
        }

        private void OnAppServicesCanceled(IBackgroundTaskInstance sender, BackgroundTaskCancellationReason reason)
        {
            CleanupConnection();
        }

        private void CleanupConnection()
        {
            if (HelperConnection != null)
            {
                HelperConnection.RequestReceived -= OnAppServiceRequestReceived;
                HelperConnection.ServiceClosed -= OnAppServiceClosed;
                HelperConnection = null;
            }

            if (AppServiceDeferral != null)
            {
                AppServiceDeferral.Complete();
                AppServiceDeferral = null;
            }

            EventHandler disconnectedHandler = HelperDisconnected;
            if (disconnectedHandler != null)
            {
                disconnectedHandler(this, EventArgs.Empty);
            }
        }
    }
}
