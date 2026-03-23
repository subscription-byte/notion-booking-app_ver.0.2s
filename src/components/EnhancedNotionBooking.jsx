import React, { useState, useEffect, useRef } from 'react';
import FluidCanvas from './FluidCanvas';
import { getRouteConfig } from '../config/routeConfig';
import { BUSINESS_HOURS, generateTimeSlots, getWeekdayDates } from '../config/businessConfig';
import { isFixedBlockedTime, isInPersonBlocked, isShootingBlocked } from '../config/blockingRules';
import { isUnavailableDay } from '../config/holidays';
import { ALERT_MESSAGES, SYSTEM_SETTINGS } from '../config/uiConfig';
import { NOTION_CONFIG, generateLineAuthUrl } from '../config/apiConfig';

const EnhancedNotionBooking = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [bookingData, setBookingData] = useState({});
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [xLink, setXLink] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [myfansStatus, setMyfansStatus] = useState(''); // myfans登録状況
  const [premiumStatus, setPremiumStatus] = useState(''); // プレミアムクリエイター登録状況
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completedBooking, setCompletedBooking] = useState(null);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [copiedForX, setCopiedForX] = useState(false);

  // テストモード関連
  const [isTestMode, setIsTestMode] = useState(false);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testLoginId, setTestLoginId] = useState('');
  const [testLoginPw, setTestLoginPw] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const tapTimerRef = useRef(null);
  const allWeeksDataRef = useRef({}); // 全週データのキャッシュ（Ref版）
  const isInitialLoadDoneRef = useRef(false); // 初回ロード完了フラグ

  const [notionEvents, setNotionEvents] = useState([]);
  const [prevWeekEvents, setPrevWeekEvents] = useState([]);
  const [nextWeekEvents, setNextWeekEvents] = useState([]);
  const [allWeeksData, setAllWeeksData] = useState({}); // 全週データのキャッシュ（{ weekKey: { data, timestamp } }）

  // キャッシュ有効期限（ミリ秒）: 15分（セッションタイムアウトと同じ）
  const CACHE_EXPIRY_MS = 15 * 60 * 1000;
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isWeekChanging, setIsWeekChanging] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    healthy: true,
    message: '',
    lastChecked: null
  });

  // スワイプ用のstate
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const swipeContainerRef = useRef(null);

  // URLパラメータから経路設定を取得
  const [routeTag, setRouteTag] = useState('');
  const [routeConfig, setRouteConfig] = useState(null); // 経路別設定
  const [showInitialForm, setShowInitialForm] = useState(true); // 最初の名前/LINE入力画面

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let ref = urlParams.get('ref');

    // LINE連携のコールバック処理（セッション方式）
    const session = urlParams.get('session_id');
    const lineName = urlParams.get('line_name');
    const lineError = urlParams.get('line_error');

    // refがない場合の処理
    if (!ref) {
      // LINE連携コールバック時のみlocalStorageから復元
      if (session || lineName || lineError) {
        const savedRef = localStorage.getItem('routeRef');
        if (savedRef) {
          ref = savedRef;
          // URLにrefを追加（LINE連携後のリダイレクト対策）
          const newUrl = `${window.location.pathname}?ref=${ref}`;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
      // 通常アクセス時はrefなしのまま（経路タグ「公認X」固定）
    } else {
      // refがある場合はlocalStorageに保存
      localStorage.setItem('routeRef', ref);
    }

    // 設定ファイルから経路設定を取得
    const config = getRouteConfig(ref);
    console.log('🔧 Route Config Debug:', { ref, config, mode: config.mode });
    setRouteConfig(config);
    setRouteTag(config.routeTag);

    if (session && lineName) {
      setSessionId(session);
      setCustomerName(lineName); // 名前を自動入力
      setShowInitialForm(false); // 初期フォームをスキップして週選択へ
      alert(ALERT_MESSAGES.lineLoginSuccess(lineName));

      // URLパラメータをクリア（refは保持）
      const newUrl = ref ? `${window.location.pathname}?ref=${ref}` : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (lineError) {
      alert(ALERT_MESSAGES.lineLoginError(lineError));
      // URLパラメータをクリア（refは保持）
      const newUrl = ref ? `${window.location.pathname}?ref=${ref}` : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    // テストモードの永続化チェック
    const savedTestMode = localStorage.getItem('testMode');
    if (savedTestMode === 'true') {
      setIsTestMode(true);
    }
  }, []);


  // 3回タップでテストログイン画面表示
  const handleSecretTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    // 既存のタイマーをクリア
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    if (newCount === 3) {
      setShowTestLogin(true);
      setTapCount(0);
    } else {
      // 2秒以内に3回タップしないとリセット
      tapTimerRef.current = setTimeout(() => {
        setTapCount(0);
      }, 2000);
    }
  };

  // テストログイン処理
  const handleTestLogin = () => {
    const validId = process.env.REACT_APP_TEST_USER_ID;
    const validPw = process.env.REACT_APP_TEST_USER_PW;

    if (testLoginId === validId && testLoginPw === validPw) {
      setIsTestMode(true);
      localStorage.setItem('testMode', 'true');
      setShowTestLogin(false);
      setTestLoginId('');
      setTestLoginPw('');
      alert(ALERT_MESSAGES.testModeEnabled);
    } else {
      alert(ALERT_MESSAGES.testLoginFailed);
    }
  };

  // テストモード解除
  const handleTestLogout = () => {
    setIsTestMode(false);
    localStorage.removeItem('testMode');
    alert(ALERT_MESSAGES.testModeDisabled);
  };


  // 設定は config ファイルからインポート済み

  const validateNotionData = (data, expectedDateRange, isInitialLoad) => {
    // API接続失敗
    if (!data || !data.results) {
      return { valid: false, reason: 'データ取得に失敗しました' };
    }

    // 初回ロード時（今週）でデータ0件は異常
    if (isInitialLoad && data.results.length === 0) {
      return { valid: false, reason: 'データの取得に問題が発生しています' };
    }

    // データがある場合、範囲外のデータが含まれていないかチェック
    if (data.results.length > 0) {
      const outOfRangeData = data.results.filter(event => {
        const eventDate = event.properties['予定日']?.date?.start;
        if (!eventDate) return false;

        const date = new Date(eventDate);
        const startDate = new Date(expectedDateRange.start);
        const endDate = new Date(expectedDateRange.end);

        // 時刻を無視して日付のみで比較
        date.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        return date < startDate || date > endDate;
      });

      // 範囲外データが全体の50%以上 = フィルター失敗
      if (outOfRangeData.length > data.results.length * 0.5) {
        return {
          valid: false,
          reason: '予期しないデータが検出されました'
        };
      }
    }

    return { valid: true };
  };

  const sendChatWorkAlert = async (alertData) => {
    try {
      await fetch('/.netlify/functions/chatwork-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData)
      });
    } catch (error) {
      console.error('ChatWork notification failed:', error);
    }
  };

  const getCurrentWeekDates = () => {
    const weekDates = getWeekdayDates(weekOffset);

    console.log('現在表示中の週:', {
      weekOffset,
      dates: weekDates.map(d => `${d.getMonth()+1}/${d.getDate()}`).join(', ')
    });

    return weekDates;
  };

  // isHoliday と generateTimeSlots は config からインポート済み

  const weekDates = getCurrentWeekDates();
  const timeSlots = generateTimeSlots(BUSINESS_HOURS.startHour, BUSINESS_HOURS.endHour);

  // 前週・翌週の日付を計算
  const getPrevWeekDates = () => getWeekdayDates(weekOffset - 1);
  const getNextWeekDates = () => getWeekdayDates(weekOffset + 1);

  // 前週・翌週のデータを取得する関数（キャッシュ付き）
  const fetchAdjacentWeeksData = async (currentOffset = null) => {
    if (process.env.NODE_ENV !== 'production') {
      setPrevWeekEvents([]);
      setNextWeekEvents([]);
      return;
    }

    const offset = currentOffset !== null ? currentOffset : weekOffset;
    const prevWeekKey = `${offset - 1}`;
    const nextWeekKey = `${offset + 1}`;
    const nextNextWeekKey = `${offset + 2}`; // 翌々週

    // offset 0未満（過去の週）は取得しない
    if (offset - 1 < 0) {
      setPrevWeekEvents([]);
      console.log('前週は過去なので取得スキップ');
    }

    // 現在のoffsetに基づいて前週・翌週・翌々週の日付を計算
    const prevWeekDates = getWeekdayDates(offset - 1);
    const nextWeekDates = getWeekdayDates(offset + 1);
    const nextNextWeekDates = getWeekdayDates(offset + 2);

    try {
      // 前週データの取得（offset 0以上の場合のみ）
      if (offset - 1 >= 0) {
        // キャッシュに前週データがあるか確認（有効期限チェック）
        const cachedPrev = allWeeksData[prevWeekKey];
        const isPrevCacheValid = cachedPrev && (Date.now() - cachedPrev.timestamp < CACHE_EXPIRY_MS);

        if (isPrevCacheValid) {
          console.log('前週データ: キャッシュから取得（有効）');
          setPrevWeekEvents(cachedPrev.data);
        } else {
          if (cachedPrev) console.log('前週データ: キャッシュ期限切れ、再取得');
        // 前週のデータ取得
        const prevResponse = await fetch(NOTION_CONFIG.endpoints.query, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            filter: {
              date: {
                on_or_after: prevWeekDates[0].getFullYear() + '-' +
                  String(prevWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                  String(prevWeekDates[0].getDate()).padStart(2, '0'),
                on_or_before: prevWeekDates[4].getFullYear() + '-' +
                  String(prevWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                  String(prevWeekDates[4].getDate()).padStart(2, '0')
              }
            }
          })
        });

        if (prevResponse.ok) {
          const prevData = await prevResponse.json();
          const prevEvents = prevData.results || [];
          const now = Date.now();
          console.log('前週データ取得&保存:', { weekKey: prevWeekKey, dataCount: prevEvents.length, timestamp: new Date(now).toLocaleTimeString() });
          setPrevWeekEvents(prevEvents);
          setAllWeeksData(prev => ({ ...prev, [prevWeekKey]: { data: prevEvents, timestamp: now } }));
        }
        }
      }

      // キャッシュに翌週データがあるか確認（有効期限チェック）
      const cachedNext = allWeeksData[nextWeekKey];
      const isNextCacheValid = cachedNext && (Date.now() - cachedNext.timestamp < CACHE_EXPIRY_MS);

      if (isNextCacheValid) {
        console.log('翌週データ: キャッシュから取得（有効）');
        setNextWeekEvents(cachedNext.data);
      } else {
        if (cachedNext) console.log('翌週データ: キャッシュ期限切れ、再取得');
        // 翌週のデータ取得
        const nextResponse = await fetch(NOTION_CONFIG.endpoints.query, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            filter: {
              date: {
                on_or_after: nextWeekDates[0].getFullYear() + '-' +
                                String(nextWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                String(nextWeekDates[0].getDate()).padStart(2, '0'),
                on_or_before: nextWeekDates[4].getFullYear() + '-' +
                 String(nextWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                 String(nextWeekDates[4].getDate()).padStart(2, '0')
              }
            }
          })
        });

        if (nextResponse.ok) {
          const nextData = await nextResponse.json();
          const nextEvents = nextData.results || [];
          const now = Date.now();
          console.log('翌週データ取得&保存:', { weekKey: nextWeekKey, dataCount: nextEvents.length, timestamp: new Date(now).toLocaleTimeString() });
          setNextWeekEvents(nextEvents);
          setAllWeeksData(prev => ({ ...prev, [nextWeekKey]: { data: nextEvents, timestamp: now } }));
        }
      }

      // 翌々週データの事前読み込み（キャッシュ期限チェック）
      const cachedNextNext = allWeeksData[nextNextWeekKey];
      const isNextNextCacheValid = cachedNextNext && (Date.now() - cachedNextNext.timestamp < CACHE_EXPIRY_MS);

      if (!isNextNextCacheValid) {
        if (cachedNextNext) console.log('翌々週データ: キャッシュ期限切れ、再取得');
        const nextNextResponse = await fetch(NOTION_CONFIG.endpoints.query, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            filter: {
              date: {
                on_or_after: nextNextWeekDates[0].getFullYear() + '-' +
                                String(nextNextWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                String(nextNextWeekDates[0].getDate()).padStart(2, '0'),
                on_or_before: nextNextWeekDates[4].getFullYear() + '-' +
                 String(nextNextWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                 String(nextNextWeekDates[4].getDate()).padStart(2, '0')
              }
            }
          })
        });

        if (nextNextResponse.ok) {
          const nextNextData = await nextNextResponse.json();
          const nextNextEvents = nextNextData.results || [];
          const now = Date.now();
          console.log('翌々週データ取得&保存:', { weekKey: nextNextWeekKey, dataCount: nextNextEvents.length, timestamp: new Date(now).toLocaleTimeString() });
          setAllWeeksData(prev => ({ ...prev, [nextNextWeekKey]: { data: nextNextEvents, timestamp: now } }));
        }
      } else {
        console.log('翌々週データ: キャッシュ有効:', nextNextWeekKey);
      }
    } catch (error) {
      console.error('前後週データの取得に失敗:', error);
    }
  };

  const fetchNotionCalendar = async (isWeekChange = false, targetWeekDates = null, currentWeekOffset = null) => {
    // 開発環境ではNotion API呼び出しをスキップ
    if (process.env.NODE_ENV !== 'production') {
      console.log('開発環境: Notion APIカレンダー取得をスキップ');
      setIsLoading(false);
      setIsInitialLoading(false);
      setIsWeekChanging(false);
      setNotionEvents([]);
      setSystemStatus({
        healthy: true,
        message: '',
        lastChecked: new Date()
      });
      return;
    }

    try {
      setIsLoading(true);
      if (isWeekChange) {
        setIsWeekChanging(true);
      } else if (isInitialLoading) {
        setIsInitialLoading(true);
      }

      const datesForQuery = targetWeekDates || weekDates;

      const response = await fetch(NOTION_CONFIG.endpoints.query, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: NOTION_CONFIG.calendarDatabaseId,
          filter: {
            date: {
              on_or_after: datesForQuery[0].getFullYear() + '-' +
                          String(datesForQuery[0].getMonth() + 1).padStart(2, '0') + '-' +
                          String(datesForQuery[0].getDate()).padStart(2, '0'),
              on_or_before: datesForQuery[4].getFullYear() + '-' +
                           String(datesForQuery[4].getMonth() + 1).padStart(2, '0') + '-' +
                           String(datesForQuery[4].getDate()).padStart(2, '0')
            }
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`API Error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const fetchedEvents = data.results || [];

      // 本番環境のみデータ検証を実施
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        const validation = validateNotionData(
          data,
          {
            start: datesForQuery[0],
            end: datesForQuery[4]
          },
          isInitialLoading
        );

        if (!validation.valid) {
          setSystemStatus({
            healthy: false,
            message: validation.reason,
            lastChecked: new Date()
          });

          // ChatWork通知
          await sendChatWorkAlert({
            type: 'system_error',
            data: {
              errorMessage: validation.reason,
              timestamp: new Date().toLocaleString('ja-JP')
            }
          });

          return;
        }
      } else {
        console.log('開発環境: データ検証をスキップ');
      }

      setNotionEvents(fetchedEvents);
      setSystemStatus({
        healthy: true,
        message: '',
        lastChecked: new Date()
      });

      // 現在の週のデータをキャッシュに保存（タイムスタンプ付き）
      const actualOffset = currentWeekOffset !== null ? currentWeekOffset : weekOffset;
      const currentWeekKey = `${actualOffset}`;
      const now = Date.now();
      console.log('キャッシュに保存:', { weekKey: currentWeekKey, actualOffset, dataCount: fetchedEvents.length, timestamp: new Date(now).toLocaleTimeString() });
      setAllWeeksData(prev => ({ ...prev, [currentWeekKey]: { data: fetchedEvents, timestamp: now } }));

      // 前後週のデータも取得（actualOffsetを明示的に渡す）
      await fetchAdjacentWeeksData(actualOffset);

      // テスト通知検知（厳密一致のみ、1回のみ送信）
      const testEvents = fetchedEvents.filter(event => {
        const name = event.properties['名前']?.title?.[0]?.text?.content;
        return name === 'テスト：システムエラー' || name === 'テスト：日付ズレ';
      });

      for (const testEvent of testEvents) {
        const name = testEvent.properties['名前']?.title?.[0]?.text?.content;
        const eventId = testEvent.id;

        if (name === 'テスト：システムエラー') {
          await sendChatWorkAlert({
            type: 'system_error',
            data: {
              errorMessage: 'これはテスト通知です（システムエラー）',
              timestamp: new Date().toLocaleString('ja-JP')
            }
          });

          // テスト予定を削除（アーカイブ）
          try {
            await fetch(NOTION_CONFIG.endpoints.archive, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageId: eventId })
            });
          } catch (error) {
            console.error('テスト予定の削除に失敗:', error);
          }
        } else if (name === 'テスト：日付ズレ') {
          await sendChatWorkAlert({
            type: 'date_mismatch',
            data: {
              selectedDate: '2025-10-10',
              registeredDate: '2025-10-11',
              customerName: 'テストユーザー',
              time: '14:00'
            }
          });

          // テスト予定を削除（アーカイブ）
          try {
            await fetch(NOTION_CONFIG.endpoints.archive, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageId: eventId })
            });
          } catch (error) {
            console.error('テスト予定の削除に失敗:', error);
          }
        }
      }

    } catch (error) {
      console.error('Notionカレンダーの取得に失敗:', error);
      setNotionEvents([]);

      // Load failed（デプロイ中の一時的エラー）は除外
      if (error.message !== 'Load failed') {
        setSystemStatus({
          healthy: false,
          message: 'システムエラーが発生しました',
          lastChecked: new Date()
        });

        // ChatWork通知
        await sendChatWorkAlert({
          type: 'system_error',
          data: {
            errorMessage: error.message,
            timestamp: new Date().toLocaleString('ja-JP')
          }
        });
      }
      
      // ネットワークエラーの場合はユーザーに通知
      if (error.message.includes('fetch') || error.message.includes('NetworkError') || !navigator.onLine) {
        alert(ALERT_MESSAGES.siteUpdating);
      }

      return [];
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
      setIsWeekChanging(false);
    }
  };

  const createNotionEvent = async (bookingData) => {
    // 開発環境では常に成功を返す
    if (process.env.NODE_ENV !== 'production') {
      console.log('開発環境: Notion API呼び出しをスキップ', bookingData);
      await new Promise(resolve => setTimeout(resolve, 500)); // 疑似遅延
      return true;
    }

    try {
      // Google Calendar用のフラット形式に変換
      const startTime = `${bookingData.date}T${bookingData.time}:00+09:00`;
      const endHour = String(parseInt(bookingData.time.split(':')[0]) + 1).padStart(2, '0');
      const endTime = `${bookingData.date}T${endHour}:00:00+09:00`;

      const properties = {
        summary: bookingData.customerName,
        date: {
          start: startTime,
          end: endTime
        },
        remarks: bookingData.remarks || '',
        xLink: bookingData.xLink || '',
        route: bookingData.routeTag || '',
        callMethod: bookingData.callMethod || '',
        myfansStatus: bookingData.myfansStatus || '',
        premiumStatus: bookingData.premiumStatus || '',
        assignee: '町谷有里',
        lineUserId: ''
      };

      // セッションID方式の場合
      const requestBody = bookingData.sessionId
        ? {
            sessionId: bookingData.sessionId,
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            properties: properties
          }
        : {
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            properties: properties
          };

      const response = await fetch(NOTION_CONFIG.endpoints.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);

        // エラー内容を画面に表示
        alert(`予約エラー (${response.status}):\n${errorText}\n\nこのメッセージをスクショして送ってください`);

        const normalizedError = (errorText || '').toLowerCase();
        const isExpectedBlockError =
          response.status === 409 ||
          (
            response.status === 403 && (
              normalizedError.includes('holiday or closed') ||
              normalizedError.includes('blocked by fixed rules') ||
              normalizedError.includes('blocked due to an in-person appointment') ||
              normalizedError.includes('blocked due to a shooting session')
            )
          );

        // 予約重複・ブロック時間は通常フロー
        if (isExpectedBlockError) {
          throw new Error('BOOKING_CONFLICT');
        }

        // 想定外の403/5xx/その他API異常はシステム通知
        await sendChatWorkAlert({
          type: 'system_error',
          data: {
            errorMessage: `Booking API error (${response.status}): ${errorText}`,
            timestamp: new Date().toLocaleString('ja-JP')
          }
        });

        throw new Error(`API Error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Notion予約作成エラー:', error);
      if (error.message === 'BOOKING_CONFLICT') {
        throw error; // 上位に伝播させる
      }
      return false;
    }
  };

  const handleWeekChange = async (newOffset) => {
    // offset 0未満への遷移を防止
    if (newOffset < 0) {
      console.log('過去の週への遷移はブロックされました:', newOffset);
      return;
    }

    setIsWeekChanging(true);

    const newWeekDates = getWeekdayDates(newOffset);

    // 先にweekOffsetを更新
    setWeekOffset(newOffset);

    // キャッシュに該当週のデータがあるか確認（Refから取得＋有効期限チェック）
    const weekKey = `${newOffset}`;
    const currentCache = allWeeksDataRef.current;
    const cachedWeek = currentCache[weekKey];
    const isCacheValid = cachedWeek && (Date.now() - cachedWeek.timestamp < CACHE_EXPIRY_MS);

    console.log('週遷移:', {
      newOffset,
      weekKey,
      hasCache: !!cachedWeek,
      isCacheValid,
      cacheAge: cachedWeek ? `${((Date.now() - cachedWeek.timestamp) / 1000).toFixed(0)}秒` : 'なし'
    });

    if (isCacheValid) {
      // キャッシュから取得（有効期限内）
      const cachedData = cachedWeek.data;
      console.log('キャッシュから取得（有効）:', cachedData.length, '件');
      console.log('キャッシュデータの日付:', cachedData.map(e => e.properties?.['予定日']?.date?.start).filter(Boolean));
      setNotionEvents(cachedData);
      // 前後週のデータも更新（newOffsetを渡す）
      await fetchAdjacentWeeksData(newOffset);
      setIsWeekChanging(false);
    } else {
      // キャッシュ期限切れまたは存在しない → API呼び出し
      if (cachedWeek) console.log('キャッシュ期限切れ、APIから再取得');
      else console.log('キャッシュなし、APIから新規取得');
      await fetchNotionCalendar(true, newWeekDates, newOffset);
    }
  };

  // スワイプハンドラー
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && !isInitialLoading && !isWeekChanging) {
      // 左スワイプ = 翌週
      handleWeekChange(weekOffset + 1);
    }
    if (isRightSwipe && !isInitialLoading && !isWeekChanging && weekOffset > 0) {
      // 右スワイプ = 前週（offset 0より大きい場合のみ）
      console.log('右スワイプ検出 - 前週へ遷移:', weekOffset - 1);
      handleWeekChange(weekOffset - 1);
    } else if (isRightSwipe && weekOffset === 0) {
      console.log('右スワイプ検出 - offset 0のためブロック');
    }
  };

  // 指定した週に空きがあるかチェックする関数
  const checkWeekHasAvailability = (dates, events) => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const date of dates) {
      // 今日より前の日付はスキップ
      if (date < today) continue;

      // 祝日はスキップ
      if (isUnavailableDay(date)) continue;

      const isToday = date.getTime() === today.getTime();

      // その日の各時間枠をチェック
      for (const time of timeSlots) {
        // 今日の場合は、現在時刻以前の枠はスキップ
        if (isToday) {
          const timeHour = parseInt(time.split(':')[0]);
          const currentHour = now.getHours();
          if (timeHour <= currentHour) continue;
        }

        const status = getBookingStatus(date, time, events);
        if (status === 'available') {
          return true;
        }
      }
    }
    return false;
  };

  // 空きのある週を探す関数
  const findWeekWithAvailability = async (startOffset = 0, maxWeeks = 12) => {
    for (let offset = startOffset; offset < startOffset + maxWeeks; offset++) {
      const testWeekDates = getWeekdayDates(offset);

      // この週のデータを取得
      try {
        const response = await fetch(NOTION_CONFIG.endpoints.query, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            filter: {
              date: {
                on_or_after: testWeekDates[0].getFullYear() + '-' +
                                String(testWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                String(testWeekDates[0].getDate()).padStart(2, '0'),
                on_or_before: testWeekDates[4].getFullYear() + '-' +
                 String(testWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                 String(testWeekDates[4].getDate()).padStart(2, '0')
              }
            }
          })
        });

        if (!response.ok) continue;

        const data = await response.json();
        const events = data.results || [];

        // この週に空きがあるかチェック
        if (checkWeekHasAvailability(testWeekDates, events)) {
          return { offset, events, weekDates: testWeekDates };
        }
      } catch (error) {
        console.error('週のチェックに失敗:', error);
        continue;
      }
    }
    return null;
  };

  useEffect(() => {
    const initializeWithAvailableWeek = async () => {
      if (!weekDates || weekDates.length === 0) return;

      // 初回ロード済みならスキップ（Refで確実にチェック）
      if (isInitialLoadDoneRef.current) {
        console.log('初回ロード済みのためスキップ');
        return;
      }

      // フラグを即座に立てて重複実行を防止
      isInitialLoadDoneRef.current = true;

      // 開発環境では通常通り
      if (process.env.NODE_ENV !== 'production') {
        fetchNotionCalendar(false);
        return;
      }

      console.log('初回ロード: 4週分のデータを一括取得開始（1回のAPI呼び出しで取得）');

      // 本番環境: 4週分のデータを1回のAPI呼び出しで取得
      try {
        const allWeeksCache = {};

        // 4週分の開始日と終了日を計算（日曜基準）
        const week0Dates = getWeekdayDates(0);
        const week3Dates = getWeekdayDates(3);
        const week0Monday = week0Dates[0]; // 最初の月曜日
        const week3Friday = week3Dates[4]; // 最後の金曜日

        console.log('取得期間:',
          week0Monday.toLocaleDateString(), '〜',
          week3Friday.toLocaleDateString()
        );

        // 1回のAPI呼び出しで4週分取得
        const response = await fetch(NOTION_CONFIG.endpoints.query, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: NOTION_CONFIG.calendarDatabaseId,
            filter: {
              date: {
                on_or_after: week0Monday.getFullYear() + '-' +
                                String(week0Monday.getMonth() + 1).padStart(2, '0') + '-' +
                                String(week0Monday.getDate()).padStart(2, '0'),
                on_or_before: week3Friday.getFullYear() + '-' +
                 String(week3Friday.getMonth() + 1).padStart(2, '0') + '-' +
                 String(week3Friday.getDate()).padStart(2, '0')
              }
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const allEvents = data.results || [];
          console.log('4週分のデータ取得完了:', allEvents.length, '件');

          // 取得したデータを週ごとに分割してキャッシュ（休業日を除外）
          for (let offset = 0; offset <= 3; offset++) {
            const weekDates = getWeekdayDates(offset);
            const monday = weekDates[0];
            const friday = weekDates[4];

            // 時刻を調整
            const mondayStart = new Date(monday);
            mondayStart.setHours(0, 0, 0, 0);
            const fridayEnd = new Date(friday);
            fridayEnd.setHours(23, 59, 59, 999);

            // この週に該当するイベントを抽出（休業日は除外）
            const weekEvents = allEvents.filter(event => {
              const eventDateStr = event.properties['予定日']?.date?.start;
              if (!eventDateStr) return false;

              // 日付文字列から日付部分のみ取得（YYYY-MM-DD）
              const datePart = eventDateStr.split('T')[0];
              const eventDate = new Date(datePart + 'T00:00:00');

              // 期間内チェック
              if (eventDate < mondayStart || eventDate > fridayEnd) return false;

              // 休業日チェック（土日・祝日・会社休業日を除外）
              if (isUnavailableDay(eventDate)) {
                return false;
              }

              return true;
            });

            allWeeksCache[offset] = { data: weekEvents, timestamp: Date.now() };
            console.log(`週${offset}のデータ振り分け完了:`, weekEvents.length, '件（休業日除外済み）');
          }
        }

        // キャッシュに一括保存（タイムスタンプ付き）
        setAllWeeksData(allWeeksCache);
        console.log('4週分のキャッシュ保存完了:', Object.keys(allWeeksCache), 'タイムスタンプ:', new Date().toLocaleTimeString());

        // 空きのある週を探す（キャッシュから）
        let targetOffset = 0;
        for (let offset = 0; offset <= 3; offset++) {
          const dates = getWeekdayDates(offset);
          const weekData = allWeeksCache[offset]?.data || [];

          if (checkWeekHasAvailability(dates, weekData)) {
            targetOffset = offset;
            console.log(`空きのある週を発見: offset ${offset}`);
            break;
          }
        }

        // 見つかった週に移動
        setWeekOffset(targetOffset);
        setNotionEvents(allWeeksCache[targetOffset]?.data || []);

        // 前後週データも設定
        if (allWeeksCache[targetOffset - 1]) {
          setPrevWeekEvents(allWeeksCache[targetOffset - 1].data);
        }
        if (allWeeksCache[targetOffset + 1]) {
          setNextWeekEvents(allWeeksCache[targetOffset + 1].data);
        }

        setSystemStatus({
          healthy: true,
          message: '',
          lastChecked: new Date()
        });
        setIsLoading(false);
        setIsInitialLoading(false);

      } catch (error) {
        console.error('初回データ取得エラー:', error);
        // エラー時は通常のフローに戻す
        fetchNotionCalendar(false);
      }
    };

    initializeWithAvailableWeek();
  }, [weekDates]); // weekDates が準備できたら実行

  // allWeeksDataの変更をRefに同期
  useEffect(() => {
    allWeeksDataRef.current = allWeeksData;
    console.log('キャッシュRefを更新:', Object.keys(allWeeksData));
  }, [allWeeksData]);

  // セッションタイムアウト機能（15分経過で強制再読み込み）
  useEffect(() => {
    // ページアクセス時の時刻を記録
    const sessionStartTime = Date.now();
    console.log('セッション開始:', new Date(sessionStartTime).toLocaleTimeString());

    // 1秒ごとにセッション時間をチェック
    const checkInterval = setInterval(() => {
      const elapsedTime = Date.now() - sessionStartTime;
      const elapsedMinutes = Math.floor(elapsedTime / 60000);

      // 15分経過したらタイムアウト
      if (elapsedMinutes >= 15) {
        console.log('セッションタイムアウト: 15分経過');
        clearInterval(checkInterval);

        alert('セッションがタイムアウトしました。\n最新の情報を表示するためページを更新します。');
        window.location.reload();
      }
    }, 1000); // 1秒ごとにチェック

    // クリーンアップ
    return () => {
      clearInterval(checkInterval);
    };
  }, []); // 初回マウント時のみ実行

  const getBookingStatus = (date, time, eventsToCheck = null) => {
    const events = eventsToCheck || notionEvents;
    if (isUnavailableDay(date)) {
      return 'holiday';
    }

    const timeHour = parseInt(time.split(':')[0]);

    // 固定ブロック時間のチェック（曜日・時間帯ベース）
    if (isFixedBlockedTime(date, timeHour)) {
      return 'booked';
    }

    const dateString = date.getFullYear() + '-' + 
                      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(date.getDate()).padStart(2, '0');

    const slotStart = new Date(`${dateString}T${time}:00+09:00`);
    const slotEnd = new Date(`${dateString}T${String(timeHour + 1).padStart(2, '0')}:00+09:00`);

    // 対面通話のブロック判定
    const hasBlockedTimeForInPerson = events.some(event =>
      isInPersonBlocked(event, slotStart, slotEnd)
    );

    if (hasBlockedTimeForInPerson) return 'booked';

    // 撮影のブロック判定
    const hasBlockedTimeForShooting = events.some(event =>
      isShootingBlocked(event, slotStart, slotEnd)
    );

    if (hasBlockedTimeForShooting) return 'booked';

    const hasNotionEvent = events.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;

      if (!eventStart) return false;

      const existingStart = new Date(eventStart);
      let existingEnd;

      if (eventEnd) {
        existingEnd = new Date(eventEnd);
      } else {
        existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);
      }

      return (existingStart < slotEnd && existingEnd > slotStart);
    });

    if (hasNotionEvent) return 'booked';

    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${time}`;
    return bookingData[key] || 'available';
  };

  const handleDateSelect = (date) => {
    if (isInitialLoading || isWeekChanging) {
      alert(ALERT_MESSAGES.dataLoading);
      return;
    }

    if (isUnavailableDay(date)) {
      alert(ALERT_MESSAGES.holidayNotAvailable);
      return;
    }

    if (getDateStatus(date) === 'full') {
      alert(ALERT_MESSAGES.fullyBooked);
      return;
    }

    setSelectedDate(date);
    setShowTimeSlots(true);
  };

  const handleTimeSelect = (time) => {
    if (isInitialLoading || isWeekChanging) {
      alert(ALERT_MESSAGES.dataLoading);
      return;
    }

    const status = getBookingStatus(selectedDate, time);
    if (status === 'available') {
      setSelectedTime(time);
      setShowTimeSlots(false);
      setShowBookingForm(true);
    } else {
      alert(ALERT_MESSAGES.timeSlotNotAvailable);
    }
  };

  const handleBooking = async () => {
    // 連打防止: 処理開始時に即座にローディング状態にする
    if (isLoading) return;
    setIsLoading(true);

    try {
      const latestEvents = await fetchNotionCalendar();

      if (isUnavailableDay(selectedDate)) {
        alert(ALERT_MESSAGES.holidayError);
        setShowBookingForm(false);
        setShowTimeSlots(false);
        setSelectedDate(null);
        setSelectedTime(null);
        setIsLoading(false);
        return;
      }

      const currentStatus = getBookingStatus(selectedDate, selectedTime, latestEvents);
      if (currentStatus !== 'available') {
        alert(ALERT_MESSAGES.alreadyBooked);
        setShowBookingForm(false);
        setSelectedTime(null);
        setIsLoading(false);
        return;
      }

      const bookingDataObj = {
        date: selectedDate.getFullYear() + '-' +
              String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' +
              String(selectedDate.getDate()).padStart(2, '0'),
        time: selectedTime,
        customerName: customerName,
        xLink: xLink,
        remarks: remarks,
        routeTag: routeTag,
        sessionId: sessionId || null,
        myfansStatus: myfansStatus,
        premiumStatus: premiumStatus
      };

      let success;
      try {
        success = await createNotionEvent(bookingDataObj);
      } catch (error) {
        if (error.message === 'BOOKING_CONFLICT') {
          // 予約重複エラー: キャッシュをクリアして最新データを再取得
          console.log('予約失敗: キャッシュをクリアして再取得');
          setAllWeeksData({}); // 全キャッシュクリア
          allWeeksDataRef.current = {}; // Refもクリア

          alert('申し訳ございません。この時間は既に予約が入っています。\n最新の空き状況に更新します。');
          setIsLoading(false);
          setShowBookingForm(false);
          setShowTimeSlots(false);
          setSelectedDate(null);
          setSelectedTime(null);
          await fetchNotionCalendar(false, weekDates, weekOffset); // 最新データ取得
          return;
        }
        throw error; // その他のエラーは通常フローへ
      }

      if (success) {
        // 日付ズレ検知: Notionから最新データを取得して確認
        await fetchNotionCalendar();

        // 作成した予定を探す（名前とXリンクで特定）
        const justCreatedEvent = notionEvents.find(event =>
          event.properties['名前']?.title?.[0]?.text?.content === customerName &&
          event.properties['X']?.url === xLink
        );

        if (justCreatedEvent) {
          const registeredDate = new Date(justCreatedEvent.properties['予定日']?.date?.start);

          // ローカル日付で比較（タイムゾーン影響を排除）
          const selectedYear = selectedDate.getFullYear();
          const selectedMonth = selectedDate.getMonth();
          const selectedDay = selectedDate.getDate();

          const registeredYear = registeredDate.getFullYear();
          const registeredMonth = registeredDate.getMonth();
          const registeredDay = registeredDate.getDate();

          // 日付ズレ検知
          if (selectedYear !== registeredYear || selectedMonth !== registeredMonth || selectedDay !== registeredDay) {
            const selectedDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
            const registeredDateStr = `${registeredYear}-${String(registeredMonth + 1).padStart(2, '0')}-${String(registeredDay).padStart(2, '0')}`;

            await sendChatWorkAlert({
              type: 'date_mismatch',
              data: {
                selectedDate: selectedDateStr,
                registeredDate: registeredDateStr,
                customerName: customerName,
                time: selectedTime
              }
            });
          }
        }

        const bookingKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}-${selectedTime}`;
        setBookingData(prev => ({
          ...prev,
          [bookingKey]: 'booked'
        }));

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1;
        const day = selectedDate.getDate();
        const dayName = getDayName(selectedDate);

        setCompletedBooking({
          year,
          month,
          day,
          dayName,
          time: selectedTime,
          customerName: customerName,
          xLink: xLink,
          remarks: remarks
        });

        // 通常リンク: 確定ボタン押下時に予約情報を自動コピー
        if (routeTag === '公認X') {
          const bookingText = `【予約完了】\n日付: ${year}年${month}月${day}日 (${dayName})\n時間: ${selectedTime}\nお名前: ${customerName}\nXリンク: ${xLink}${remarks ? `\n備考: ${remarks}` : ''}`;
          navigator.clipboard.writeText(bookingText).catch(err => {
            console.error('クリップボードコピー失敗:', err);
          });
        }

        // ChatWork通知はgoogle-calendar-create.js（バックエンド）で送信

        setShowBookingForm(false);
        setShowTimeSlots(false);
        setShowConfirmation(true);
        setShowCompletionModal(true);
      } else {
        alert(ALERT_MESSAGES.bookingFailed);
      }
    } catch (error) {
      console.error('予約エラー:', error);

      // ネットワークエラーやデプロイ中の場合
      if (error.message && (error.message.includes('fetch') || error.message.includes('NetworkError')) || !navigator.onLine) {
        alert(ALERT_MESSAGES.siteUpdating);
      } else {
        alert(ALERT_MESSAGES.bookingFailed);
      }
    } finally {
      // 最終的にローディング解除
      setIsLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  const getDayName = (date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  const getDateStatus = (date) => {
    if (isUnavailableDay(date)) return 'holiday';

    const availableSlots = timeSlots.filter(time =>
      getBookingStatus(date, time) === 'available'
    ).length;

    if (availableSlots === 0) return 'full';
    if (availableSlots <= 3) return 'few';
    return 'available';
  };

  const getDateStatusIcon = (status) => {
    switch (status) {
      case 'holiday': return '🚫';
      case 'full': return '❌';
      case 'few': return '⚠️';
      case 'available': return '✅';
      default: return '✅';
    }
  };

  const getDateStatusText = (status) => {
    switch (status) {
      case 'holiday': return '休業日';
      case 'full': return '満員';
      case 'few': return '残少';
      case 'available': return '空あり';
      default: return '空あり';
    }
  };

  const getTimeTableDisplay = (date) => {
    if (isUnavailableDay(date)) return null;
    
    const timeStatuses = timeSlots.map(time => ({
      time: time,
      available: getBookingStatus(date, time) === 'available'
    }));
    
    return timeStatuses;
  };

  const getDateCardClass = (date) => {
    const status = getDateStatus(date);
    const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();

    if (isSelected) {
      return 'gradient-border bg-gradient-to-br from-purple-50 to-pink-50 shadow-2xl transform scale-105';
    }

    switch (status) {
      case 'holiday':
        return 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed';
      case 'full':
        return 'bg-red-50 border-red-200 opacity-75 cursor-not-allowed';
      case 'few':
        return 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200 hover:shadow-xl hover-lift cursor-pointer';
      case 'available':
        return 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-xl hover-lift cursor-pointer';
      default:
        return 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-xl hover-lift cursor-pointer';
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden overscroll-none touch-pan-y" style={{ overscrollBehavior: 'none' }}>
      {/* Fluid Background Canvas */}
      <FluidCanvas />

      {/* テストモードバナー */}
      {isTestMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-black px-4 py-2 text-center text-sm font-bold z-[60] flex items-center justify-between">
          <div className="flex-1 text-center">
            🧪 テストモード - 開発中機能が表示されています
          </div>
          <button
            onClick={handleTestLogout}
            className="bg-black text-yellow-400 px-3 py-1 rounded text-xs hover:bg-gray-800"
          >
            解除
          </button>
        </div>
      )}

      {/* テストログイン画面 */}
      {showTestLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🧪 テストモード</h2>
              <p className="text-sm text-gray-600">開発者用ログイン</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID</label>
                <input
                  type="text"
                  value={testLoginId}
                  onChange={(e) => setTestLoginId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="ユーザーID"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={testLoginPw}
                  onChange={(e) => setTestLoginPw(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTestLogin()}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="パスワード"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowTestLogin(false);
                  setTestLoginId('');
                  setTestLoginPw('');
                }}
                className="flex-1 py-3 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleTestLogin}
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:shadow-xl"
              >
                ログイン
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予約完了モーダル */}
      {showCompletionModal && completedBooking && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-8">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-exclamation-triangle text-orange-500 text-xl"></i>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2">ご連絡をお忘れなく</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                完了画面に表示される予約情報を、窓口またはチャットまでお送りください。<br />
                <span className="font-bold text-red-600">ご連絡がない場合、ご予約を取り消しさせていただく場合がございます。</span>
              </p>
            </div>
            <div className="space-y-2">
              {routeConfig?.routeTag === '公認X' ? (
                <div>
                  <p className="text-xs text-gray-500 text-center mb-2">
                    ボタンを押すと予約情報が自動でコピーされます。<br />
                    X（DM画面）で<span className="font-bold text-gray-700">貼り付け・ペースト</span>するだけで送信できます。
                  </p>
                  <button
                    disabled={copiedForX}
                    onClick={() => {
                      const bookingText = `【予約完了】\n日付: ${completedBooking.year}年${completedBooking.month}月${completedBooking.day}日 (${completedBooking.dayName})\n時間: ${completedBooking.time}\nお名前: ${completedBooking.customerName}\nXリンク: ${completedBooking.xLink}${completedBooking.remarks ? `\n備考: ${completedBooking.remarks}` : ''}`;
                      navigator.clipboard.writeText(bookingText);
                      setCopiedForX(true);
                      setTimeout(() => {
                        setShowCompletionModal(false);
                        setCopiedForX(false);
                        window.open('https://x.com/myfans_agency_', '_blank');
                      }, 1500);
                    }}
                    className={`w-full py-3 text-white font-bold text-sm rounded-xl shadow-lg transition-all ${
                      copiedForX
                        ? 'bg-green-500'
                        : 'bg-gradient-to-r from-black to-gray-800 active:scale-95'
                    }`}
                  >
                    {copiedForX ? (
                      <><i className="fas fa-check mr-2"></i>コピーしました！ Xへ移動中...</>
                    ) : (
                      <><i className="fab fa-x-twitter mr-2"></i>コピーしてXへ移動</>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    window.open('line://', '_blank');
                  }}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-sm rounded-xl shadow-lg active:scale-95 transition-transform"
                >
                  <i className="fab fa-line mr-2"></i>
                  LINEを開く
                </button>
              )}
              <button
                onClick={() => setShowCompletionModal(false)}
                className="w-full py-2 text-gray-500 text-sm font-medium"
              >
                あとで送る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* コピー完了通知 */}
      {showCopyNotification && (
        <div
          className="fixed top-20 left-1/2 z-50 transition-all duration-300 ease-in-out"
          style={{
            transform: 'translate(-50%, 0)',
            animation: 'fadeInOut 3s ease-in-out'
          }}
        >
          <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3">
            <i className="fas fa-check-circle text-2xl"></i>
            <span className="font-bold text-lg">予約情報をコピーしました！</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          10% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          90% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
        }
      `}</style>

      {/* Main Content */}
      <div className="relative" style={{ zIndex: 10, pointerEvents: 'none' }}>
        <div className="relative max-w-full sm:max-w-2xl px-0 sm:px-4" style={{ pointerEvents: 'auto', margin: '0 auto' }}>
          {/* ヘッダー */}
          <div className="sticky top-0 z-50 shadow-2xl mx-5 sm:mx-9" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 192, 203, 0.3)'
          }}>
            <div className="p-2 sm:p-4" style={{
              background: 'linear-gradient(135deg, rgba(255, 192, 203, 0.2), rgba(255, 218, 185, 0.2))'
            }}>
              <div className="text-center">
                <h1
                  className="text-lg sm:text-2xl font-bold tracking-wide mb-0.5 sm:mb-1 select-none"
                  onClick={handleSecretTap}
                  style={{
                    background: 'linear-gradient(135deg, #ff69b4, #ff1493, #ff69b4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: '0 0 20px rgba(255, 105, 180, 0.3)'
                  }}
                >
                  <i className="fas fa-calendar-alt mr-1 sm:mr-2 text-sm sm:text-base" style={{color: '#ff69b4'}}></i>
                  {SYSTEM_SETTINGS.systemTitle}
                </h1>
                <p className="text-pink-600 text-xs sm:text-sm font-light tracking-wide">{SYSTEM_SETTINGS.description}</p>
                <p className="text-pink-400 text-xs font-light tracking-wide mt-0.5">（営業時間　12:00~21:00（土日祝、休業日を除く））</p>
              </div>
            </div>

            {/* プログレスバー */}
            {(isLoading || isInitialLoading || isWeekChanging) && (
              <div className="h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-pulse"></div>
            )}
          </div>

          {/* メインコンテンツ */}
          <div className="p-1.5 sm:p-4 space-y-2 sm:space-y-4">
            {/* 初期フォーム画面（LINE連携 or 名前入力） */}
            {showInitialForm && (
              <div>
                {/* 注意事項 */}
                <div className="mx-5 sm:mx-9 mb-3 rounded-xl p-3 sm:p-4 space-y-2 text-left" style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <p className="font-bold text-pink-600 mb-1" style={{ fontSize: '0.8rem' }}>
                    <i className="fas fa-info-circle mr-1"></i>ご予約の前にお読みください
                  </p>
                  <p style={{ fontSize: '0.7rem', color: '#374151' }}>・本ツールにて表示以外の時間での対応は行っておりません。表示中の空きがございますお日時にてご都合を調整していただけますと幸いです。</p>
                  <p style={{ fontSize: '0.7rem', color: '#374151' }}>・ご予約後、完了画面に表示される内容を窓口またはチャットまでお送りください。ご連絡いただけない場合、ご予約を取り消しさせて頂く場合がございます。</p>
                  <p style={{ fontSize: '0.7rem', color: '#374151' }}>・チャット等での対応は、12:00〜21:00までとなっております。時間外にご予約・ご連絡いただいた場合、翌営業日のお返事となりますことをご了承ください。</p>
                </div>
              <div className="flex items-center justify-center">
                {/* routeConfig読み込み中はローディング表示 */}
                {!routeConfig ? (
                  <div className="glassmorphism rounded-2xl p-6 sm:p-8 shadow-xl max-w-md w-full mx-4">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">読み込み中...</p>
                    </div>
                  </div>
                ) : (
                  <div className="glassmorphism rounded-2xl p-6 sm:p-8 shadow-xl max-w-md w-full mx-4">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-gradient mb-2">
                        {routeConfig.mode === 'lineLogin' ? '予約を始める' : 'お名前とXリンクを入力'}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {routeConfig.mode === 'lineLogin'
                          ? 'LINE連携で簡単予約＆リマインド♪'
                          : 'ご予約に必要な情報を入力してください'}
                      </p>
                    </div>

                    {/* 名前+X入力フォーム */}
                    {routeConfig.mode === 'nameAndX' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-gray-700 font-bold mb-2 text-sm">
                          <i className="fas fa-user mr-2 text-purple-500"></i>
                          お名前 <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-600 mb-2">{routeConfig?.mode === 'lineLogin' ? 'LINE上での表示名をご入力ください' : 'X上でのお名前をご入力ください'}</p>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full p-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all"
                          placeholder={routeConfig?.mode === 'lineLogin' ? 'LINE上での表示名を入力' : 'X上でのお名前を入力'}
                        />
                      </div>

                      <div>
                        <label className="block text-gray-700 font-bold mb-2 text-sm">
                          <i className="fab fa-x-twitter mr-2 text-purple-500"></i>
                          Xリンク <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={xLink}
                          onChange={(e) => setXLink(e.target.value)}
                          className="w-full p-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all"
                          placeholder="https://x.com/username"
                        />
                      </div>

                      <button
                        onClick={() => {
                          if (!customerName.trim()) {
                            alert(ALERT_MESSAGES.nameRequired);
                            return;
                          }
                          if (!xLink.trim()) {
                            alert(ALERT_MESSAGES.xLinkRequired);
                            return;
                          }
                          // Xリンク・IDのバリデーション（通常リンクのみ）
                          if (routeTag === '公認X') {
                            const isValidXLink =
                              xLink.includes('x.com') ||
                              xLink.includes('twitter.com') ||
                              xLink.trim().startsWith('@');
                            const isMyfansLink = xLink.includes('myfans.jp');

                            if (!isValidXLink || isMyfansLink) {
                              alert(ALERT_MESSAGES.xLinkInvalid);
                              return;
                            }
                          }
                          setShowInitialForm(false);
                        }}
                        disabled={!customerName.trim() || !xLink.trim()}
                        className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        予約画面へ進む
                        <i className="fas fa-arrow-right ml-2"></i>
                      </button>
                    </div>
                    )}

                    {/* LINE連携 */}
                    {routeConfig.mode === 'lineLogin' && (() => {
                      const urlParams = new URLSearchParams(window.location.search);
                      const ref = urlParams.get('ref') || '';
                      return ref === 'personC'
                        ? !!process.env.REACT_APP_LINE_CHANNEL_ID_C
                        : !!process.env.REACT_APP_LINE_CHANNEL_ID;
                    })() && (
                    <div className="space-y-4">
                      <button
                        onClick={() => {
                          const urlParams = new URLSearchParams(window.location.search);
                          const ref = urlParams.get('ref') || '';
                          const LINE_CHANNEL_ID = ref === 'personC'
                            ? process.env.REACT_APP_LINE_CHANNEL_ID_C
                            : process.env.REACT_APP_LINE_CHANNEL_ID;
                          const lineAuthUrl = generateLineAuthUrl(LINE_CHANNEL_ID, ref);
                          console.log('LINE認証URL:', lineAuthUrl);
                          console.log('Channel ID:', LINE_CHANNEL_ID);
                          console.log('Ref:', ref);
                          window.location.href = lineAuthUrl;
                        }}
                        className="w-full py-4 rounded-xl font-bold text-lg bg-green-500 text-white hover:bg-green-600 hover:shadow-2xl transition-all flex items-center justify-center"
                      >
                        <i className="fab fa-line mr-2 text-2xl"></i>
                        LINEで予約する
                      </button>

                      <p className="text-xs text-gray-500 text-center">
                        ※LINE連携で予約完了時に通知が届きます
                      </p>
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* システムエラー画面 */}
            {!systemStatus.healthy && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
                <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h2 className="text-2xl font-bold text-red-600 mb-4">
                    システムメンテナンス中
                  </h2>
                  <p className="text-gray-700 mb-6">
                    {systemStatus.message}<br/>
                    ただいまシステムの不具合により、予約を一時停止しております。<br/>
                    しばらく時間をおいてから再度アクセスしてください。
                  </p>
                  {systemStatus.lastChecked && (
                    <p className="text-sm text-gray-500 mb-4">
                      最終確認: {systemStatus.lastChecked.toLocaleTimeString('ja-JP')}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      const urlParams = new URLSearchParams(window.location.search);
                      const ref = urlParams.get('ref');
                      if (ref) {
                        window.location.href = `${window.location.pathname}?ref=${ref}`;
                      } else {
                        window.location.reload();
                      }
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <i className="fas fa-sync-alt mr-2"></i>
                    再読み込み
                  </button>
                </div>
              </div>
            )}

            {/* 確認画面 */}
            {showConfirmScreen && !showConfirmation && (
              <div className="px-3 sm:px-0">
                <div className="flex items-center mb-2">
                  <button
                    onClick={() => {
                      setShowConfirmScreen(false);
                      setShowBookingForm(true);
                    }}
                    className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110"
                  >
                    <i className="fas fa-arrow-left text-sm"></i>
                  </button>
                  <h2 className="ml-2 sm:ml-3 text-sm sm:text-xl font-bold text-gradient">予約内容の確認</h2>
                </div>
                <div className="glassmorphism rounded-xl sm:rounded-2xl p-3 sm:p-8 shadow-2xl">
                  {/* 通常リンク: 予約確定後の流れを最上部に表示 */}
                  {routeConfig?.routeTag === '公認X' && (
                    <div className="mb-3 sm:mb-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-orange-400 rounded-lg sm:rounded-xl p-3 sm:p-6">
                      <div className="text-center">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 shadow-lg">
                          <i className="fas fa-exclamation-triangle text-white text-lg sm:text-2xl"></i>
                        </div>
                        <h3 className="text-base sm:text-lg text-orange-800 font-bold mb-2 sm:mb-3">
                          予約確定後の流れ
                        </h3>
                        <div className="text-left text-xs sm:text-sm text-orange-700 space-y-1.5 sm:space-y-2">
                          <p className="flex items-start">
                            <span className="font-bold mr-2">1️⃣</span>
                            <span>予約情報を自動コピー <span className="text-orange-500 font-bold">（自動）</span></span>
                          </p>
                          <p className="flex items-start">
                            <span className="font-bold mr-2">2️⃣</span>
                            <span>X公認代理店プロフィールへ移動 <span className="text-orange-500 font-bold">（自動）</span></span>
                          </p>
                          <p className="flex items-start">
                            <span className="font-bold mr-2">3️⃣</span>
                            <span>DM画面を開いて、コピー済みの予約情報をペースト＆送信</span>
                          </p>
                        </div>
                        <p className="text-xs sm:text-sm text-orange-800 font-bold mt-2 sm:mt-3">
                          ※送信完了で予約確定となります
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PersonA/B: 従来の案内 */}
                  {routeConfig?.routeTag !== '公認X' && (
                    <div className="mb-3 sm:mb-6 bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-300 rounded-lg sm:rounded-xl p-3 sm:p-6">
                      <div className="text-center">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 shadow-lg">
                          <i className="fas fa-share-alt text-white text-lg sm:text-2xl"></i>
                        </div>
                        <p className="text-base sm:text-lg text-pink-700 leading-relaxed font-bold">
                          予約情報は確定後、担当者までお送りください
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 sm:space-y-4 bg-white/50 backdrop-blur rounded-lg sm:rounded-xl p-3 sm:p-6">
                    <div className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-200">
                      <span className="text-sm sm:text-base font-semibold text-gray-700 flex items-center">
                        <i className="fas fa-calendar-alt mr-1.5 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                        日付
                      </span>
                      <span className="text-sm sm:text-lg font-bold text-gray-800">
                        {selectedDate && `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 (${getDayName(selectedDate)})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-200">
                      <span className="text-sm sm:text-base font-semibold text-gray-700 flex items-center">
                        <i className="fas fa-clock mr-1.5 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                        時間
                      </span>
                      <span className="text-sm sm:text-lg font-bold text-gray-800">
                        {selectedTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-200">
                      <span className="text-sm sm:text-base font-semibold text-gray-700 flex items-center">
                        <i className="fas fa-user mr-1.5 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                        お名前
                      </span>
                      <span className="text-sm sm:text-lg font-bold text-gray-800">
                        {customerName}
                      </span>
                    </div>

                    {/* Xリンクはrequired時のみ表示 */}
                    {routeConfig?.requireXLink && xLink && (
                    <div className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-200">
                      <span className="text-sm sm:text-base font-semibold text-gray-700 flex items-center">
                        <i className="fab fa-x-twitter mr-1.5 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                        Xリンク
                      </span>
                      <span className="text-sm sm:text-base font-bold text-gray-800 break-all">
                        {xLink}
                      </span>
                    </div>
                    )}

                    {remarks && (
                      <div className="py-3">
                        <span className="font-semibold text-gray-700 flex items-center mb-2">
                          <i className="fas fa-comment-dots mr-2 text-purple-500"></i>
                          備考
                        </span>
                        <p className="text-gray-800 bg-gray-50 rounded-lg p-3">
                          {remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 sm:space-x-4 mt-3">
                  <button
                    onClick={() => {
                      setShowConfirmScreen(false);
                      setShowBookingForm(true);
                    }}
                    className="flex-1 py-2.5 sm:py-4 rounded-lg sm:rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-sm sm:text-lg hover:bg-gray-100 transition-all duration-300"
                  >
                    <i className="fas fa-edit mr-1 sm:mr-2 text-xs sm:text-base"></i>
                    修正する
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={isLoading}
                    className="flex-1 py-2.5 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm sm:text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-300 active:scale-95 sm:hover:scale-105 disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        処理中...
                      </>
                    ) : routeConfig?.routeTag === '公認X' ? (
                      <span className="flex flex-col items-center leading-tight">
                        <span><i className="fas fa-rocket mr-1"></i>確定してXの</span>
                        <span>DMへ進む</span>
                      </span>
                    ) : (
                      <>
                        <i className="fas fa-check-circle mr-2"></i>
                        予約を確定する
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 予約完了画面 */}
            {showConfirmation && completedBooking && (
              <div className="space-y-6 scale-90 px-3 sm:px-0" style={{ transformOrigin: 'top center' }}>
                <div className="rounded-xl sm:rounded-2xl p-3 sm:p-8 shadow-xl" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <div className="text-center">
                    <div className="mb-3 sm:mb-6">
                      <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-pink-400 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-xl">
                        <i className="fas fa-check text-white text-xl sm:text-3xl"></i>
                      </div>
                    </div>

                    <h2 className="text-base sm:text-xl font-bold text-black mb-2 sm:mb-4">予約が完了しました！</h2>

                    {/* 通常リンク: X送信案内 */}
                    {routeConfig?.routeTag === '公認X' && (
                      <div className="mb-3 sm:mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg sm:rounded-xl p-3 sm:p-4">
                        <div className="text-center">
                          <p className="text-xs sm:text-sm text-blue-700 mb-2">
                            👉 X公認代理店のDMで予約情報を貼り付けて送信してください<br />
                            <span className="font-bold">送信完了で予約確定となります</span>
                          </p>
                          <button
                            onClick={() => {
                              const bookingText = `【予約完了】\n日付: ${completedBooking.year}年${completedBooking.month}月${completedBooking.day}日 (${completedBooking.dayName})\n時間: ${completedBooking.time}\nお名前: ${completedBooking.customerName}\nXリンク: ${completedBooking.xLink}${completedBooking.remarks ? `\n備考: ${completedBooking.remarks}` : ''}`;
                              navigator.clipboard.writeText(bookingText);
                              window.open('https://x.com/myfans_agency_', '_blank');
                            }}
                            className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-black to-gray-800 text-white font-bold text-xs sm:text-base rounded-lg sm:rounded-xl shadow-lg active:scale-95 transition-transform"
                          >
                            <i className="fab fa-x-twitter mr-1 sm:mr-2"></i>
                            コピーしてXへ移動
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PersonA/B: 従来の共有案内 */}
                    {routeConfig?.routeTag !== '公認X' && (
                      <div className="mb-3 sm:mb-6 bg-gradient-to-br from-pink-50 to-rose-50 border-2 sm:border-3 border-pink-300 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-xl">
                        <div className="text-center">
                          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                            <i className="fas fa-share-alt text-white text-lg sm:text-2xl"></i>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-pink-700 mb-1.5 sm:mb-2">
                            予約情報は以下より<br />担当者へお送りください
                          </h3>
                          <p className="text-xs sm:text-sm text-pink-600 mb-2 sm:mb-3">
                            下のボタンから予約情報をコピーして、担当者に送信できます
                          </p>

                        <div className="space-y-1.5 sm:space-y-2">
                          {/* コピーボタン */}
                          <button
                            onClick={() => {
                              const bookingText = `【予約完了】\n日付: ${completedBooking.year}年${completedBooking.month}月${completedBooking.day}日 (${completedBooking.dayName})\n時間: ${completedBooking.time}\nお名前: ${completedBooking.customerName}\nXリンク: ${completedBooking.xLink}${completedBooking.remarks ? `\n備考: ${completedBooking.remarks}` : ''}`;
                              navigator.clipboard.writeText(bookingText);
                              setShowCopyNotification(true);
                              setTimeout(() => setShowCopyNotification(false), 3000);
                            }}
                            className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold text-xs sm:text-base rounded-lg sm:rounded-xl shadow-lg active:scale-95 sm:hover:scale-105 transition-transform"
                          >
                            <i className="fas fa-copy mr-1 sm:mr-2"></i>
                            予約情報をコピー
                          </button>

                          {/* LINEで送るボタン */}
                          <button
                            onClick={() => {
                              const bookingText = `【予約完了】
日付: ${completedBooking.year}年${completedBooking.month}月${completedBooking.day}日 (${completedBooking.dayName})
時間: ${completedBooking.time}
お名前: ${completedBooking.customerName}
Xリンク: ${completedBooking.xLink}${completedBooking.remarks ? `
備考: ${completedBooking.remarks}` : ''}`;
                              window.open(`https://line.me/R/msg/text/?${encodeURIComponent(bookingText)}`, '_blank');
                            }}
                            className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-xs sm:text-base rounded-lg sm:rounded-xl shadow-lg active:scale-95 sm:hover:scale-105 transition-transform"
                          >
                            <i className="fab fa-line mr-1 sm:mr-2"></i>
                            LINEで送る
                          </button>

                          {/* Xで送るボタン */}
                          <button
                            onClick={() => {
                              const bookingText = `【予約完了】\n日付: ${completedBooking.year}年${completedBooking.month}月${completedBooking.day}日 (${completedBooking.dayName})\n時間: ${completedBooking.time}\nお名前: ${completedBooking.customerName}\nXリンク: ${completedBooking.xLink}${completedBooking.remarks ? `\n備考: ${completedBooking.remarks}` : ''}`;
                              navigator.clipboard.writeText(bookingText);
                              alert('予約情報をコピーしました！\n\nこの後X公認代理店のプロフィール画面が開きます。\nDMで貼り付けて送信してください。');
                              window.open('https://x.com/myfans_agency_', '_blank');
                            }}
                            className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-black to-gray-800 text-white font-bold text-xs sm:text-base rounded-lg sm:rounded-xl shadow-lg active:scale-95 sm:hover:scale-105 transition-transform"
                          >
                            <i className="fab fa-x-twitter mr-1 sm:mr-2"></i>
                            Xで送る
                          </button>
                        </div>
                      </div>
                    </div>
                    )}

                    <div className="space-y-2 sm:space-y-4 text-left bg-white/50 backdrop-blur rounded-lg sm:rounded-xl p-3 sm:p-6">
                      <div className="flex items-center justify-between py-1.5 sm:py-3 border-b border-gray-200">
                        <span className="text-xs sm:text-base font-semibold text-gray-700 flex items-center">
                          <i className="fas fa-calendar-alt mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                          日付
                        </span>
                        <span className="text-sm sm:text-lg font-bold text-gray-800">
                          {completedBooking.year}年{completedBooking.month}月{completedBooking.day}日 ({completedBooking.dayName})
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 sm:py-3 border-b border-gray-200">
                        <span className="text-xs sm:text-base font-semibold text-gray-700 flex items-center">
                          <i className="fas fa-clock mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                          時間
                        </span>
                        <span className="text-sm sm:text-lg font-bold text-gray-800">
                          {completedBooking.time}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 sm:py-3 border-b border-gray-200">
                        <span className="text-xs sm:text-base font-semibold text-gray-700 flex items-center">
                          <i className="fas fa-user mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                          お名前
                        </span>
                        <span className="text-sm sm:text-lg font-bold text-gray-800">
                          {completedBooking.customerName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 sm:py-3 border-b border-gray-200">
                        <span className="text-xs sm:text-base font-semibold text-gray-700 flex items-center">
                          <i className="fab fa-x-twitter mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                          Xリンク
                        </span>
                        <a
                          href={completedBooking.xLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm sm:text-lg font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <i className="fas fa-external-link-alt mr-1 text-xs"></i>
                          リンクを開く
                        </a>
                      </div>

                      {completedBooking.remarks && (
                        <div className="py-1.5 sm:py-3">
                          <span className="text-xs sm:text-base font-semibold text-gray-700 flex items-center mb-1 sm:mb-2">
                            <i className="fas fa-comment-dots mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                            備考
                          </span>
                          <p className="text-xs sm:text-base text-gray-800 bg-gray-50 rounded-lg p-2 sm:p-3">
                            {completedBooking.remarks}
                          </p>
                        </div>
                      )}
                    </div>


                    <div className="mt-3 sm:mt-6">
                      <button
                        onClick={() => {
                          setShowConfirmation(false);
                          setShowConfirmScreen(false);
                          setCompletedBooking(null);
                          setSelectedDate(null);
                          setSelectedTime(null);
                          setCustomerName('');
                          setXLink('');
                          setRemarks('');
                        }}
                        className="px-4 sm:px-8 py-2 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm sm:text-lg rounded-lg sm:rounded-xl shadow-lg active:scale-95 sm:hover:scale-105 transition-transform"
                      >
                        <i className="fas fa-home mr-1 sm:mr-2"></i>
                        トップに戻る
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!showInitialForm && !showTimeSlots && !showBookingForm && !showConfirmScreen && !showConfirmation && (
              <div className="scale-100" style={{ transformOrigin: 'top center' }}>
                {/* 週選択 */}
                <div className="rounded-lg sm:rounded-xl p-2 sm:p-4 shadow-xl mx-5 sm:mx-9" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => handleWeekChange(weekOffset - 1)}
                      disabled={isInitialLoading || isWeekChanging || weekOffset === 0}
                      className="group px-2 sm:px-3 py-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-lg text-xs sm:text-sm font-medium shadow-lg sm:hover:shadow-xl transition-all duration-300 sm:hover:-translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                      <div className="text-center">
                        <div className="text-xs">前週</div>
                        <div className="text-xs sm:text-sm">
                          <i className="fas fa-chevron-left sm:group-hover:-translate-x-1 transition-transform"></i>
                        </div>
                      </div>
                    </button>

                    <div className="text-center">
                      <div className="text-sm sm:text-lg font-bold text-gradient">
                        {weekDates && weekDates.length > 0 ? `${formatDate(weekDates[0])} - ${formatDate(weekDates[4])}` : '読み込み中...'}
                      </div>
                      <div className="text-xs text-gray-500 font-light">平日のみ表示</div>
                    </div>

                    <button
                      onClick={() => handleWeekChange(weekOffset + 1)}
                      disabled={isInitialLoading || isWeekChanging}
                      className="group px-2 sm:px-3 py-1 bg-gradient-to-r from-pink-500 to-pink-400 text-white rounded-lg text-xs sm:text-sm font-medium shadow-lg sm:hover:shadow-xl transition-all duration-300 sm:hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                      <div className="text-center">
                        <div className="text-xs">翌週</div>
                        <div className="text-xs sm:text-sm">
                          <i className="fas fa-chevron-right sm:group-hover:translate-x-1 transition-transform"></i>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 凡例 */}
                <div className="rounded-lg sm:rounded-xl p-1.5 sm:p-2 shadow-md mx-5 sm:mx-9" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <div className="grid grid-cols-4 gap-1 sm:gap-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm sm:text-lg">✅</span>
                      <span className="text-xs font-medium text-gray-700">空あり</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm sm:text-lg">⚠️</span>
                      <span className="text-xs font-medium text-gray-700">残少</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm sm:text-lg">❌</span>
                      <span className="text-xs font-medium text-gray-700">満員</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm sm:text-lg">🚫</span>
                      <span className="text-xs font-medium text-gray-700">休業</span>
                    </div>
                  </div>
                </div>

                {/* 日付選択 */}
                <div
                  className="mt-2 sm:mt-3 relative sm:mx-0"
                  style={{ marginLeft: '-22px', marginRight: '-22px' }}
                  ref={swipeContainerRef}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  {/* カスタムアニメーション用のスタイル */}
                  <style>{`
                    @keyframes arrowPulse {
                      0%, 100% {
                        opacity: 0.75;
                        transform: scale(1);
                      }
                      50% {
                        opacity: 0.5;
                        transform: scale(0.9);
                      }
                    }
                    .arrow-pulse {
                      animation: arrowPulse 2s ease-in-out infinite;
                    }
                    @keyframes sidePulse {
                      0%, 100% {
                        opacity: 0.75;
                      }
                      50% {
                        opacity: 0.5;
                      }
                    }
                    .side-pulse {
                      animation: sidePulse 2s ease-in-out infinite;
                    }
                  `}</style>

                  {/* 左矢印 */}
                  <div
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 ${weekOffset === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !isInitialLoading && !isWeekChanging && weekOffset > 0 && handleWeekChange(weekOffset - 1)}
                  >
                    <span className="text-pink-500 text-3xl arrow-pulse">◀</span>
                  </div>

                  {/* 右矢印 */}
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 cursor-pointer"
                    onClick={() => !isInitialLoading && !isWeekChanging && handleWeekChange(weekOffset + 1)}
                  >
                    <span className="text-pink-500 text-3xl arrow-pulse">▶</span>
                  </div>

                  {/* メインコンテンツ */}
                  <div className="space-y-1.5 sm:space-y-2">

                  {(isInitialLoading || isWeekChanging) && (
                    <div className="rounded-lg sm:rounded-xl p-4 sm:p-8 text-center animate-pulse" style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 192, 203, 0.3)'
                    }}>
                      <div className="inline-block">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-2 sm:mb-4"></div>
                        <p className="text-gradient font-semibold text-xs sm:text-base">データを読み込んでいます...</p>
                      </div>
                    </div>
                  )}

                  {/* 状態に応じた色を取得 */}
                  {(() => {
                    const getStatusColor = (s) => {
                      switch (s) {
                        case 'holiday': return 'bg-gray-200';
                        case 'full': return 'bg-red-100';
                        case 'few': return 'bg-orange-100';
                        case 'available': return 'bg-green-100';
                        default: return 'bg-green-100';
                      }
                    };

                    const getPrevDateStatus = (idx) => {
                      const prevDate = getPrevWeekDates()[idx];
                      if (isUnavailableDay(prevDate)) return 'holiday';
                      const availableSlots = timeSlots.filter(time =>
                        getBookingStatus(prevDate, time, prevWeekEvents) === 'available'
                      ).length;
                      if (availableSlots === 0) return 'full';
                      if (availableSlots <= 3) return 'few';
                      return 'available';
                    };

                    const getNextDateStatus = (idx) => {
                      const nextDate = getNextWeekDates()[idx];
                      if (isUnavailableDay(nextDate)) return 'holiday';
                      const availableSlots = timeSlots.filter(time =>
                        getBookingStatus(nextDate, time, nextWeekEvents) === 'available'
                      ).length;
                      if (availableSlots === 0) return 'full';
                      if (availableSlots <= 3) return 'few';
                      return 'available';
                    };

                    return null;
                  })()}

                  <div className="flex" style={{ perspective: '1000px' }}>
                    {/* 左側の板（前週の状態） - offset 0では透明 */}
                    <div className={`w-8 flex-shrink-0 mr-1 flex flex-col space-y-1 sm:space-y-2 transition-opacity duration-300 ${weekOffset === 0 ? 'opacity-0' : 'side-pulse'}`} style={{ transform: 'rotateY(-45deg)', transformOrigin: 'right center' }}>
                      {[0, 1, 2, 3, 4].map(idx => {
                        const prevDate = getPrevWeekDates()[idx];
                        let status = 'available';
                        if (isUnavailableDay(prevDate)) {
                          status = 'holiday';
                        } else {
                          const availableSlots = timeSlots.filter(time =>
                            getBookingStatus(prevDate, time, prevWeekEvents) === 'available'
                          ).length;
                          if (availableSlots === 0) status = 'full';
                          else if (availableSlots <= 3) status = 'few';
                        }
                        const colorClass = status === 'holiday' ? 'bg-gray-200' : status === 'full' ? 'bg-red-100' : status === 'few' ? 'bg-orange-100' : 'bg-green-100';
                        return <div key={idx} className={`flex-1 rounded-lg ${colorClass}`}></div>;
                      })}
                    </div>

                    {/* メインコンテンツ */}
                    <div className="flex-1 space-y-1 sm:space-y-2">
                    {weekDates.map((date, index) => {
                      const status = getDateStatus(date);
                      const isDisabled = isInitialLoading || isWeekChanging || isUnavailableDay(date) || status === 'full';

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(date)}
                          disabled={isDisabled}
                          className={`w-full p-1.5 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all duration-300 ${getDateCardClass(date)} ${isDisabled ? '' : 'active:scale-[0.98] sm:hover:scale-[1.02]'}`}
                        >
                            <div className="flex items-center">
                              <div className="text-center px-0 sm:px-3 w-16 sm:w-24 flex-shrink-0">
                                <div className="text-xs sm:text-sm font-medium text-gray-500">{date.getFullYear()}年</div>
                                <div className="text-sm sm:text-lg font-bold text-gray-800">{formatDate(date)}</div>
                                <div className="text-sm font-medium text-gray-600">({getDayName(date)})</div>
                              </div>
                              <div className="flex-1 pl-2 sm:pl-4 pr-2 sm:pr-3 min-w-0">
                                {!isInitialLoading && !isWeekChanging && getTimeTableDisplay(date) && (
                                  <div className="w-full">
                                    <div className="grid grid-cols-3 gap-1">
                                      {[0, 1, 2].map(colIndex => (
                                        <div key={colIndex} className="bg-white/80 rounded-lg border border-gray-200 overflow-hidden">
                                          {getTimeTableDisplay(date).slice(colIndex * 3, (colIndex + 1) * 3).map((slot, idx) => (
                                            <div key={idx} className={`grid grid-cols-2 text-xs border-b border-gray-100 ${idx === 2 ? 'border-b-0' : ''}`}>
                                              <div className="px-1 py-0.5 text-center font-medium text-gray-700">
                                                {slot.time}
                                              </div>
                                              <div className="px-1 py-0.5 text-center border-l border-gray-100">
                                                {slot.available ? '✅' : '❌'}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* 祝日表示のみ */}
                                {isUnavailableDay(date) && (
                                  <div className="flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl mb-1">{getDateStatusIcon(status)}</span>
                                    <span className="text-xs font-medium text-gray-600">{getDateStatusText(status)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                      );
                    })}
                    </div>

                    {/* 右側の板（翌週の状態） */}
                    <div className="w-8 flex-shrink-0 ml-1 side-pulse flex flex-col space-y-1 sm:space-y-2" style={{ transform: 'rotateY(45deg)', transformOrigin: 'left center' }}>
                      {[0, 1, 2, 3, 4].map(idx => {
                        const nextDate = getNextWeekDates()[idx];
                        let status = 'available';
                        if (isUnavailableDay(nextDate)) {
                          status = 'holiday';
                        } else {
                          const availableSlots = timeSlots.filter(time =>
                            getBookingStatus(nextDate, time, nextWeekEvents) === 'available'
                          ).length;
                          if (availableSlots === 0) status = 'full';
                          else if (availableSlots <= 3) status = 'few';
                        }
                        const colorClass = status === 'holiday' ? 'bg-gray-200' : status === 'full' ? 'bg-red-100' : status === 'few' ? 'bg-orange-100' : 'bg-green-100';
                        return <div key={idx} className={`flex-1 rounded-lg ${colorClass}`}></div>;
                      })}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* 時間選択画面 */}
            {showTimeSlots && !showBookingForm && (
              <div className="space-y-4 scale-90 px-3 sm:px-0" style={{ transformOrigin: 'top center' }}>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      console.log('戻るボタン: 状態をリセット');
                      setShowTimeSlots(false);
                      setSelectedDate(null);
                      setSelectedTime(null);
                      setShowConfirmScreen(false);
                      setShowConfirmation(false);
                    }}
                    className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110"
                  >
                    <i className="fas fa-arrow-left text-sm"></i>
                  </button>
                  <div className="ml-4">
                    <h2 className="text-lg font-bold text-gradient">時間を選択</h2>
                    <p className="text-sm text-gray-600">
                      {selectedDate && formatFullDate(selectedDate)} ({selectedDate && getDayName(selectedDate)})
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 説明文を表示 */}
                  <div className="relative p-3 rounded-xl font-bold text-base bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-200">
                    <div className="text-lg mb-1">
                      <i className="far fa-clock text-pink-500"></i>
                    </div>
                    <div className="text-sm font-bold text-gray-700">ご希望の時間を選択してください</div>
                  </div>
                  {timeSlots.map((time) => {
                    const status = getBookingStatus(selectedDate, time);
                    const isAvailable = status === 'available';

                    return (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        disabled={!isAvailable}
                        className={`relative p-3 rounded-xl font-bold text-base transition-all duration-300 transform ${
                          isAvailable
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className="text-lg mb-1">
                          <i className={`far ${isAvailable ? 'fa-clock' : 'fa-times-circle'}`}></i>
                        </div>
                        <div className="text-lg font-bold">{time}</div>
                        <div className="text-xs mt-1 opacity-90">
                          {isAvailable ? '予約可能' : '予約済み'}
                        </div>
                        {isAvailable && (
                          <div className="absolute top-2 right-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 予約フォーム */}
            {showBookingForm && (
              <div className="space-y-3 sm:space-y-6 px-3 sm:px-0 overflow-y-auto"
                style={{ maxHeight: 'calc(100dvh - 80px)', WebkitOverflowScrolling: 'touch', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
                <div className="flex items-center mb-2">
                  <button
                    onClick={() => {
                      setShowBookingForm(false);
                      setShowTimeSlots(true);
                    }}
                    className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110"
                  >
                    <i className="fas fa-arrow-left text-sm"></i>
                  </button>
                </div>
                <div className="glassmorphism rounded-lg sm:rounded-2xl p-3 sm:p-6 shadow-xl">
                  <div className="text-sm sm:text-lg font-bold text-purple-800 mb-2 sm:mb-3">予約内容確認</div>
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex items-center text-gray-800">
                      <i className="fas fa-calendar-alt mr-2 sm:mr-3 text-purple-500 text-base sm:text-lg"></i>
                      <span className="text-xs sm:text-base font-bold">{selectedDate && formatFullDate(selectedDate)} ({selectedDate && getDayName(selectedDate)})</span>
                    </div>
                    <div className="flex items-center text-gray-800">
                      <i className="fas fa-clock mr-2 sm:mr-3 text-purple-500 text-base sm:text-lg"></i>
                      <span className="text-xs sm:text-base font-bold">{selectedTime}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-6">
                  {/* お名前（編集可能） */}
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fas fa-user mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      お名前 <span className="text-red-500 ml-1">*</span>
                      {sessionId && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center">
                          <i className="fab fa-line mr-1"></i>
                          LINE連携済み
                        </span>
                      )}
                    </label>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">{routeConfig?.mode === 'lineLogin' ? 'LINE上での表示名をご入力ください' : 'X上でのお名前をご入力ください'}</p>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-sm sm:text-lg bg-white/80 backdrop-blur"
                      placeholder={routeConfig?.mode === 'lineLogin' ? 'LINE上での表示名を入力' : 'X上でのお名前を入力'}
                      required
                    />
                  </div>

                  {/* Xリンク */}
                  {routeConfig?.requireXLink && (
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fab fa-x-twitter mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      Xリンク <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="url"
                      value={xLink}
                      onChange={(e) => setXLink(e.target.value)}
                      className="w-full p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-sm sm:text-lg bg-white/80 backdrop-blur"
                      placeholder="https://x.com/username"
                      required
                    />
                  </div>
                  )}

                  {/* myfans登録状況 */}
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fas fa-check-circle mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      myfansをご利用中（登録済）ですか？未登録ですか？ <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center p-2.5 sm:p-3 rounded-lg border-2 border-purple-200 bg-white/80 backdrop-blur cursor-pointer hover:bg-purple-50 transition-all duration-200">
                        <input
                          type="radio"
                          name="myfansStatus"
                          value="登録済"
                          checked={myfansStatus === '登録済'}
                          onChange={(e) => {
                            setMyfansStatus(e.target.value);
                            setPremiumStatus(''); // リセット
                          }}
                          className="mr-2 sm:mr-3 w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm sm:text-base">登録済</span>
                      </label>
                      <label className="flex items-center p-2.5 sm:p-3 rounded-lg border-2 border-purple-200 bg-white/80 backdrop-blur cursor-pointer hover:bg-purple-50 transition-all duration-200">
                        <input
                          type="radio"
                          name="myfansStatus"
                          value="未登録"
                          checked={myfansStatus === '未登録'}
                          onChange={(e) => {
                            setMyfansStatus(e.target.value);
                            setPremiumStatus(''); // 未登録の場合はP登録状況もリセット
                          }}
                          className="mr-2 sm:mr-3 w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm sm:text-base">未登録</span>
                      </label>
                    </div>
                  </div>

                  {/* プレミアムクリエイター登録状況（myfans登録済の場合のみ表示） */}
                  {myfansStatus === '登録済' && (
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fas fa-star mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      プレミアムクリエイター登録状況について教えて下さい <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center p-2.5 sm:p-3 rounded-lg border-2 border-purple-200 bg-white/80 backdrop-blur cursor-pointer hover:bg-purple-50 transition-all duration-200">
                        <input
                          type="radio"
                          name="premiumStatus"
                          value="登録済"
                          checked={premiumStatus === '登録済'}
                          onChange={(e) => setPremiumStatus(e.target.value)}
                          className="mr-2 sm:mr-3 w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm sm:text-base">登録済</span>
                      </label>
                      <label className="flex items-center p-2.5 sm:p-3 rounded-lg border-2 border-purple-200 bg-white/80 backdrop-blur cursor-pointer hover:bg-purple-50 transition-all duration-200">
                        <input
                          type="radio"
                          name="premiumStatus"
                          value="未登録"
                          checked={premiumStatus === '未登録'}
                          onChange={(e) => setPremiumStatus(e.target.value)}
                          className="mr-2 sm:mr-3 w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm sm:text-base">未登録</span>
                      </label>
                    </div>
                  </div>
                  )}

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fas fa-comment-dots mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      備考 <span className="text-gray-400 text-xs sm:text-sm ml-2">(任意)</span>
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-sm sm:text-lg bg-white/80 backdrop-blur resize-none"
                      placeholder="ご要望や連絡事項がありましたらご記入ください"
                      rows="3"
                    />
                  </div>

                  <div className="flex space-x-2 sm:space-x-4">
                    <button
                      onClick={() => {
                        setShowBookingForm(false);
                        setShowTimeSlots(true);
                      }}
                      className="flex-1 py-2.5 sm:py-4 rounded-lg sm:rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-sm sm:text-lg active:bg-gray-100 sm:hover:bg-gray-100 transition-all duration-300"
                    >
                      <i className="fas fa-times mr-1 sm:mr-2"></i>
                      キャンセル
                    </button>
                    <button
                      onClick={() => {
                        // バリデーション: 設定ファイルに基づいて判定
                        if (!customerName.trim()) {
                          alert(ALERT_MESSAGES.nameNotEntered);
                          return;
                        }
                        if (routeConfig?.requireXLink && !xLink.trim()) {
                          alert(ALERT_MESSAGES.xLinkRequired);
                          return;
                        }
                        // Xリンク・IDのバリデーション（通常リンク・personBのみ）
                        if (routeConfig?.requireXLink && (routeTag === '公認X' || routeTag === 'まゆ紹介')) {
                          const isValidXLink =
                            xLink.includes('x.com') ||
                            xLink.includes('twitter.com') ||
                            xLink.trim().startsWith('@');
                          const isMyfansLink = xLink.includes('myfans.jp');

                          if (!isValidXLink || isMyfansLink) {
                            alert(ALERT_MESSAGES.xLinkInvalid);
                            return;
                          }
                        }
                        // myfans関連のバリデーション
                        if (!myfansStatus) {
                          alert('myfansの登録状況を選択してください');
                          return;
                        }
                        if (myfansStatus === '登録済' && !premiumStatus) {
                          alert('プレミアムクリエイター登録状況を選択してください');
                          return;
                        }
                        setShowBookingForm(false);
                        setShowConfirmScreen(true);
                      }}
                      disabled={
                        !customerName.trim() ||
                        (routeConfig?.requireXLink && !xLink.trim()) ||
                        !myfansStatus ||
                        (myfansStatus === '登録済' && !premiumStatus)
                      }
                      className="flex-1 py-2.5 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm sm:text-lg shadow-lg active:scale-95 sm:hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 sm:hover:scale-105 disabled:hover:scale-100"
                    >
                      <i className="fas fa-arrow-right mr-1 sm:mr-2"></i>
                      確認画面へ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedNotionBooking;
