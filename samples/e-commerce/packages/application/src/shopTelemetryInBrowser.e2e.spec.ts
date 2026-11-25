import { afterAll, beforeAll, describe, it } from 'vitest';
import { browserE2ESpecification } from './browserE2ESpecification';
import { warehouseKeeper } from './shipments/sandbox/warehouseKeeper';
import { customerInBrowser } from './shop/customerInBrowser';
import { ordersPageOf } from './shop/shopUrls';
import { shopTestApplication } from './shopTestApplication';
import { grafanaApi } from './telemetry/grafanaApi';
import {
  exportingOverOtlp,
  serviceName,
  startTelemetry,
} from './telemetry/telemetry';
import {
  startGrafana,
  startKafka,
  startPostgreSQL,
} from './testInfrastructure';

const screenshotsFolder =
  process.env['SCREENSHOTS_DIR'] ?? 'test-results/screenshots';

describe('a customer shops in a browser on Kafka and PostgreSQL, and the purchase reaches Grafana', () => {
  let kafka: Awaited<ReturnType<typeof startKafka>>;
  let postgreSQL: Awaited<ReturnType<typeof startPostgreSQL>>;
  let grafana: Awaited<ReturnType<typeof startGrafana>>;
  let telemetry: ReturnType<typeof startTelemetry>;

  beforeAll(async () => {
    [kafka, postgreSQL, grafana] = await Promise.all([
      startKafka(),
      startPostgreSQL(),
      startGrafana(),
    ]);
    telemetry = startTelemetry(exportingOverOtlp(grafana.otlpEndpoint, 1000));
  }, 240_000);

  afterAll(async () => {
    await telemetry.stop();
    await Promise.all([kafka.stop(), postgreSQL.stop(), grafana.stop()]);
  });

  const shop = browserE2ESpecification(
    shopTestApplication({
      environment: () => ({
        MESSAGING_BUS: 'kafka',
        EVENTSTORE_TYPE: 'postgresql',
        POSTGRESQL_URL: postgreSQL.connectionString,
        KAFKA_BOOTSTRAP_SERVERS: kafka.connection.bootstrapBrokers.join(','),
      }),
    }),
  );

  const shopping = () => {
    const customer = customerInBrowser(shop);
    const cartWithTwoProducts = [
      customer.logsIn(),
      customer.addsToCart(0),
      customer.addsToCart(1),
    ];
    const orderAwaitingPayment = [...cartWithTwoProducts, customer.checksOut()];
    const paymentPage = [...orderAwaitingPayment, customer.paysNow()];
    const paidOrder = [...paymentPage, customer.paysWithACardThatWorks()];

    return {
      ...shop,
      customer,
      warehouse: warehouseKeeper(shop),
      grafana: grafanaApi(grafana.url),
      cartWithTwoProducts,
      orderAwaitingPayment,
      paymentPage,
      paidOrder,
    };
  };

  const scenario = (name: string, run: () => Promise<void>, timeout?: number) =>
    it(name, run, timeout);

  scenario(
    'checkingOutShowsTheOrderAwaitingPaymentOnceTheWorkflowPlacedIt',
    () => {
      const {
        given,
        customer,
        cartWithTwoProducts,
        expectPageAt,
        expectPageShowing,
        expectNoFailedResponses,
      } = shopping();

      return given(...cartWithTwoProducts)
        .when(customer.checksOut())
        .then(
          expectPageAt(new RegExp(`${customer.orderPage}$`)),
          expectPageShowing('Awaiting payment', 'Pay now'),
          expectNoFailedResponses,
        );
    },
  );

  scenario(
    'payingReturnsToTheOrderWhichWaitsForTheWarehouseToSendThePackage',
    () => {
      const {
        given,
        customer,
        paymentPage,
        expectPageShowing,
        expectPageNotShowing,
        expectNoFailedResponses,
      } = shopping();

      return given(...paymentPage)
        .when(customer.paysWithACardThatWorks())
        .then(
          expectPageShowing('Processing'),
          expectPageNotShowing('Pay now'),
          expectNoFailedResponses,
        );
    },
  );

  scenario(
    'theWarehouseSendingThePackageCompletesTheOrderOnTheCustomersPageInPlace',
    () => {
      const {
        given,
        customer,
        warehouse,
        paidOrder,
        expectPageShowing,
        expectPageNotShowing,
        expectUpdatedInPlace,
        expectNoFailedResponses,
      } = shopping();

      return given(...paidOrder)
        .when(warehouse.sendsThePackageOf(customer))
        .then(
          expectPageShowing('Completed', 'Sandbox Express'),
          expectPageNotShowing('Pay now'),
          expectUpdatedInPlace,
          expectNoFailedResponses,
        );
    },
  );

  scenario('theWarehouseRejectingThePackageCancelsTheOrder', () => {
    const {
      given,
      customer,
      warehouse,
      paidOrder,
      expectPageShowing,
      expectNoFailedResponses,
    } = shopping();

    return given(...paidOrder)
      .when(warehouse.rejectsThePackageOf(customer))
      .then(expectPageShowing('Canceled'), expectNoFailedResponses);
  });

  scenario(
    'theSoldOutProductLeavesTheOrderOutOfStockWithOnlyTheWayToCancelIt',
    () => {
      const {
        given,
        customer,
        expectPageShowing,
        expectPageNotShowing,
        expectNoFailedResponses,
      } = shopping();

      return given(customer.logsIn(), customer.addsToCart(4))
        .when(customer.checksOut())
        .then(
          expectPageShowing('Out of stock', 'Cancel order'),
          expectPageNotShowing('Pay now'),
          expectNoFailedResponses,
        );
    },
  );

  scenario('theOrdersPageListsTheCompletedOrder', () => {
    const {
      given,
      customer,
      warehouse,
      paidOrder,
      expectPageAt,
      expectPageShowing,
    } = shopping();

    return given(
      ...paidOrder,
      warehouse.sendsThePackageOf(customer),
      customer.waitsUntilTheOrderIs('Completed'),
    )
      .when(customer.opensOrders())
      .then(
        expectPageAt(new RegExp(`${ordersPageOf(customer.customerId)}$`)),
        expectPageShowing('Completed'),
      );
  });

  scenario('aSecondTabShowsTheChangeInPlace', () => {
    const {
      given,
      customer,
      orderAwaitingPayment,
      expectPageShowing,
      expectUpdatedInPlace,
    } = shopping();

    return given(...orderAwaitingPayment)
      .when(customer.cancelsInAnotherTab())
      .then(expectPageShowing('Canceled'), expectUpdatedInPlace);
  });

  scenario(
    'aPurchaseReachesGrafanaAsTracesAsMetricsAndAsLogs',
    () => {
      const {
        given,
        customer,
        warehouse,
        paidOrder,
        grafana: inGrafana,
        expectPage,
        expectPageShowing,
      } = shopping();
      return given(...paidOrder)
        .when(warehouse.sendsThePackageOf(customer))
        .then(
          expectPageShowing('Completed'),
          inGrafana.expectTracesInTempo(
            `{ resource.service.name = "${serviceName}" }`,
          ),
          inGrafana.expectEventsAppended('orders.OrderPlaced'),
          inGrafana.expectEventsAppended('orders.OrderCompleted'),
          inGrafana.expectLogsOf(serviceName),
          inGrafana.expectMetricInPrometheus(
            'sum(emmett_workflow_processing_duration_count)',
          ),
          inGrafana.expectAlertRules(
            'Payments failing',
            'Capture failed',
            'Money lost',
            'Checkout broken',
            'Views falling behind',
            'Dead letters',
            'Commands failing',
            'HTTP errors',
          ),
          inGrafana.expectMetricInPrometheus(
            'sum(http_server_request_duration_seconds_count)',
          ),
          inGrafana.expectMetricInPrometheus('sum(messaging_published_total)'),
          inGrafana.expectMetricInPrometheus('sum(messaging_handled_total)'),
          expectPage((page) =>
            inGrafana.screenshotOf(
              page,
              'e-commerce-purchases',
              `${screenshotsFolder}/13-grafana-purchases.png`,
            ),
          ),
          expectPage((page) =>
            inGrafana.screenshotOf(
              page,
              'commands-and-event-store',
              `${screenshotsFolder}/14-grafana-commands-and-event-store.png`,
            ),
          ),
          expectPage((page) =>
            inGrafana.screenshotOf(
              page,
              'purchase-flow',
              `${screenshotsFolder}/15-grafana-purchase-flow.png`,
            ),
          ),
          expectPage((page) =>
            inGrafana.screenshotOfRow(
              page,
              'e-commerce-purchases',
              'Business',
              'Order lead time',
              `${screenshotsFolder}/18-grafana-business.png`,
            ),
          ),
          expectPage((page) =>
            inGrafana.screenshotOfAlertRules(
              page,
              'E-Commerce',
              'Capture failed',
              `${screenshotsFolder}/19-grafana-alert-rules.png`,
            ),
          ),
        );
    },
    180_000,
  );
});
