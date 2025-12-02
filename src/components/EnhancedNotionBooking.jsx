import React, { useState, useEffect, useRef } from 'react';
import FluidCanvas from './FluidCanvas';

const EnhancedNotionBooking = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [bookingData, setBookingData] = useState({});
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [xLink, setXLink] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [lineName, setLineName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completedBooking, setCompletedBooking] = useState(null);
  const [showCopyNotification, setShowCopyNotification] = useState(false);

  // テストモード関連
  const [isTestMode, setIsTestMode] = useState(false);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testLoginId, setTestLoginId] = useState('');
  const [testLoginPw, setTestLoginPw] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const tapTimerRef = useRef(null);

  const [notionEvents, setNotionEvents] = useState([]);
  const [prevWeekEvents, setPrevWeekEvents] = useState([]);
  const [nextWeekEvents, setNextWeekEvents] = useState([]);
  const [allWeeksData, setAllWeeksData] = useState({}); // 全週データのキャッシュ
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

  // URLパラメータから経路タグを取得
  const [routeTag, setRouteTag] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref === 'personA') {
      setRouteTag('公認X');
    } else if (ref === 'personB') {
      setRouteTag('まゆ紹介');
    }

    // LINE連携のコールバック処理
    const lineUserId = urlParams.get('line_user_id');
    const lineName = urlParams.get('line_name');
    const lineError = urlParams.get('line_error');

    if (lineUserId && lineName) {
      setLineUserId(lineUserId);
      setLineName(lineName);
      setCustomerName(lineName); // 名前を自動入力
      alert(`✅ LINE連携成功！\n\nこんにちは、${lineName}さん\n予約完了時にLINE通知が届きます。`);

      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (lineError) {
      alert(`❌ LINE連携エラー\n\n${lineError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
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
      alert('🧪 テストモードを起動しました');
    } else {
      alert('IDまたはパスワードが間違っています');
    }
  };

  // テストモード解除
  const handleTestLogout = () => {
    setIsTestMode(false);
    localStorage.removeItem('testMode');
    alert('テストモードを解除しました');
  };


  const settings = {
    immediateButtonText: '今すぐ予約する',
    startHour: 12,
    endHour: 21,
    systemTitle: '予約システム',
    description: 'ご希望の日時を選択してください'
  };

  const holidays2025 = [
    '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23',
    '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04',
    '2025-05-05', '2025-07-21', '2025-08-11', '2025-09-15',
    '2025-09-23', '2025-10-13', '2025-11-03', '2025-11-23',
  ];

  const CALENDAR_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

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
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + (weekOffset * 7));

    const weekDates = [];

    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }

    console.log('現在表示中の週:', {
      weekOffset,
      dates: weekDates.map(d => `${d.getMonth()+1}/${d.getDate()}`).join(', ')
    });

    return weekDates;
  };

  const isHoliday = (date) => {
    const dateString = date.getFullYear() + '-' + 
                      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(date.getDate()).padStart(2, '0');


    return holidays2025.includes(dateString);
  };

  const generateTimeSlots = (startHour, endHour) => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      slots.push(time);
    }
    return slots;
  };

  const weekDates = getCurrentWeekDates();
  const timeSlots = generateTimeSlots(settings.startHour, settings.endHour);

  // 前週・翌週の日付を計算
  const getPrevWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + ((weekOffset - 1) * 7));

    const weekDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const getNextWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + ((weekOffset + 1) * 7));

    const weekDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

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

    // offset 0未満（過去の週）は取得しない
    if (offset - 1 < 0) {
      setPrevWeekEvents([]);
      console.log('前週は過去なので取得スキップ');
    }

    // 現在のoffsetに基づいて前週・翌週の日付を計算
    const today = new Date();
    const currentDay = today.getDay();

    // 前週の日付
    const prevMonday = new Date(today);
    prevMonday.setDate(today.getDate() - currentDay + 1 + ((offset - 1) * 7));
    const prevWeekDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(prevMonday);
      date.setDate(prevMonday.getDate() + i);
      prevWeekDates.push(date);
    }

    // 翌週の日付
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() - currentDay + 1 + ((offset + 1) * 7));
    const nextWeekDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(nextMonday);
      date.setDate(nextMonday.getDate() + i);
      nextWeekDates.push(date);
    }

    try {
      // 前週データの取得（offset 0以上の場合のみ）
      if (offset - 1 >= 0) {
        // キャッシュに前週データがあるか確認
        if (allWeeksData[prevWeekKey]) {
          setPrevWeekEvents(allWeeksData[prevWeekKey]);
        } else {
        // 前週のデータ取得
        const prevResponse = await fetch('/.netlify/functions/notion-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: CALENDAR_DATABASE_ID,
            filter: {
              and: [
                {
                  property: '予定日',
                  date: {
                    on_or_after: prevWeekDates[0].getFullYear() + '-' +
                                String(prevWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                String(prevWeekDates[0].getDate()).padStart(2, '0')
                  }
                },
                {
                  property: '予定日',
                  date: {
                    on_or_before: prevWeekDates[4].getFullYear() + '-' +
                                 String(prevWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                                 String(prevWeekDates[4].getDate()).padStart(2, '0')
                  }
                }
              ]
            }
          })
        });

        if (prevResponse.ok) {
          const prevData = await prevResponse.json();
          const prevEvents = prevData.results || [];
          console.log('前週データ取得&保存:', { weekKey: prevWeekKey, dataCount: prevEvents.length });
          setPrevWeekEvents(prevEvents);
          setAllWeeksData(prev => ({ ...prev, [prevWeekKey]: prevEvents }));
        }
        }
      }

      // キャッシュに翌週データがあるか確認
      if (allWeeksData[nextWeekKey]) {
        setNextWeekEvents(allWeeksData[nextWeekKey]);
      } else {
        // 翌週のデータ取得
        const nextResponse = await fetch('/.netlify/functions/notion-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: CALENDAR_DATABASE_ID,
            filter: {
              and: [
                {
                  property: '予定日',
                  date: {
                    on_or_after: nextWeekDates[0].getFullYear() + '-' +
                                String(nextWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                String(nextWeekDates[0].getDate()).padStart(2, '0')
                  }
                },
                {
                  property: '予定日',
                  date: {
                    on_or_before: nextWeekDates[4].getFullYear() + '-' +
                                 String(nextWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                                 String(nextWeekDates[4].getDate()).padStart(2, '0')
                  }
                }
              ]
            }
          })
        });

        if (nextResponse.ok) {
          const nextData = await nextResponse.json();
          const nextEvents = nextData.results || [];
          console.log('翌週データ取得&保存:', { weekKey: nextWeekKey, dataCount: nextEvents.length });
          setNextWeekEvents(nextEvents);
          setAllWeeksData(prev => ({ ...prev, [nextWeekKey]: nextEvents }));
        }
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

      const response = await fetch('/.netlify/functions/notion-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          databaseId: CALENDAR_DATABASE_ID,
          filter: {
            and: [
              {
                property: '予定日',
                date: {
                  on_or_after: datesForQuery[0].getFullYear() + '-' +
                              String(datesForQuery[0].getMonth() + 1).padStart(2, '0') + '-' +
                              String(datesForQuery[0].getDate()).padStart(2, '0')
                }
              },
              {
                property: '予定日',
                date: {
                  on_or_before: datesForQuery[4].getFullYear() + '-' +
                               String(datesForQuery[4].getMonth() + 1).padStart(2, '0') + '-' +
                               String(datesForQuery[4].getDate()).padStart(2, '0')
                }
              }
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error('Notion APIエラー');
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

      // 現在の週のデータをキャッシュに保存
      const actualOffset = currentWeekOffset !== null ? currentWeekOffset : weekOffset;
      const currentWeekKey = `${actualOffset}`;
      console.log('キャッシュに保存:', { weekKey: currentWeekKey, actualOffset, dataCount: fetchedEvents.length });
      setAllWeeksData(prev => ({ ...prev, [currentWeekKey]: fetchedEvents }));

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
            await fetch('/.netlify/functions/notion-archive', {
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
            await fetch('/.netlify/functions/notion-archive', {
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
        alert('ただいまサイト情報の更新中です。お手数をおかけいたしますが、数分後に再度お試しください。');
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
      const properties = {
        '名前': {
          title: [
            {
              text: {
                content: bookingData.customerName
              }
            }
          ]
        },
        '予定日': {
          date: {
            start: `${bookingData.date}T${bookingData.time}:00+09:00`,
            end: `${bookingData.date}T${String(parseInt(bookingData.time.split(':')[0]) + 1).padStart(2, '0')}:00+09:00`
          }
        },
        'X': {
          url: bookingData.xLink
        },
        '備考': {
          rich_text: bookingData.remarks ? [
            {
              text: {
                content: bookingData.remarks
              }
            }
          ] : []
        },
        '対応者': {
          people: [
            {
              id: '1ffd872b-594c-8107-b306-000269021f07'
            }
          ]
        }
      };

      // 経路タグがある場合は追加
      if (bookingData.routeTag) {
        properties['経路'] = {
          select: {
            name: bookingData.routeTag
          }
        };
      }

      // LINE User IDがある場合は追加（Notionに「LINE User ID」列（rich_text型）が必要）
      if (bookingData.lineUserId) {
        properties['LINE User ID'] = {
          rich_text: [
            {
              text: {
                content: bookingData.lineUserId
              }
            }
          ]
        };
      }

      const response = await fetch('/.netlify/functions/notion-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: CALENDAR_DATABASE_ID },
          properties: properties
        })
      });

      if (!response.ok) {
        throw new Error('Notion APIエラー');
      }

      return true;
    } catch (error) {
      console.error('Notion予約作成エラー:', error);
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

    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + (newOffset * 7));

    const newWeekDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      newWeekDates.push(date);
    }

    // 先にweekOffsetを更新
    setWeekOffset(newOffset);

    // キャッシュに該当週のデータがあるか確認
    const weekKey = `${newOffset}`;
    console.log('週遷移:', { newOffset, weekKey, hasCache: !!allWeeksData[weekKey], cacheKeys: Object.keys(allWeeksData) });

    if (allWeeksData[weekKey]) {
      // キャッシュから取得
      const cachedData = allWeeksData[weekKey];
      console.log('キャッシュから取得:', cachedData.length, '件');
      console.log('キャッシュデータの日付:', cachedData.map(e => e.properties?.['予定日']?.date?.start).filter(Boolean));
      setNotionEvents(cachedData);
      // 前後週のデータも更新（newOffsetを渡す）
      await fetchAdjacentWeeksData(newOffset);
      setIsWeekChanging(false);
    } else {
      // API呼び出し
      console.log('APIから新規取得');
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
      if (isHoliday(date)) continue;

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
      const today = new Date();
      const currentDay = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - currentDay + 1 + (offset * 7));

      const testWeekDates = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        testWeekDates.push(date);
      }

      // この週のデータを取得
      try {
        const response = await fetch('/.netlify/functions/notion-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            databaseId: CALENDAR_DATABASE_ID,
            filter: {
              and: [
                {
                  property: '予定日',
                  date: {
                    on_or_after: testWeekDates[0].getFullYear() + '-' +
                                String(testWeekDates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                String(testWeekDates[0].getDate()).padStart(2, '0')
                  }
                },
                {
                  property: '予定日',
                  date: {
                    on_or_before: testWeekDates[4].getFullYear() + '-' +
                                 String(testWeekDates[4].getMonth() + 1).padStart(2, '0') + '-' +
                                 String(testWeekDates[4].getDate()).padStart(2, '0')
                  }
                }
              ]
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
      if (!weekDates || weekDates.length === 0 || !isInitialLoading) return;

      // 開発環境では通常通り
      if (process.env.NODE_ENV !== 'production') {
        fetchNotionCalendar(false);
        return;
      }

      console.log('初回ロード: 4週分のデータを一括取得開始');

      // 本番環境: まず4週分のデータを一括取得してキャッシュ
      try {
        const today = new Date();
        const currentDay = today.getDay();
        const allWeeksCache = {};

        // offset 0〜3までの4週分を取得
        for (let offset = 0; offset <= 3; offset++) {
          const monday = new Date(today);
          monday.setDate(today.getDate() - currentDay + 1 + (offset * 7));

          const dates = [];
          for (let i = 0; i < 5; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            dates.push(date);
          }

          // API呼び出し
          const response = await fetch('/.netlify/functions/notion-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              databaseId: CALENDAR_DATABASE_ID,
              filter: {
                and: [
                  {
                    property: '予定日',
                    date: {
                      on_or_after: dates[0].getFullYear() + '-' +
                                  String(dates[0].getMonth() + 1).padStart(2, '0') + '-' +
                                  String(dates[0].getDate()).padStart(2, '0')
                    }
                  },
                  {
                    property: '予定日',
                    date: {
                      on_or_before: dates[4].getFullYear() + '-' +
                                   String(dates[4].getMonth() + 1).padStart(2, '0') + '-' +
                                   String(dates[4].getDate()).padStart(2, '0')
                    }
                  }
                ]
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const events = data.results || [];
            allWeeksCache[offset] = events;
            console.log(`週${offset}のデータ取得完了:`, events.length, '件');
          }
        }

        // キャッシュに一括保存
        setAllWeeksData(allWeeksCache);
        console.log('4週分のキャッシュ保存完了:', Object.keys(allWeeksCache));

        // 空きのある週を探す（キャッシュから）
        let targetOffset = 0;
        for (let offset = 0; offset <= 3; offset++) {
          const monday = new Date(today);
          monday.setDate(today.getDate() - currentDay + 1 + (offset * 7));

          const dates = [];
          for (let i = 0; i < 5; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            dates.push(date);
          }

          if (checkWeekHasAvailability(dates, allWeeksCache[offset] || [])) {
            targetOffset = offset;
            console.log(`空きのある週を発見: offset ${offset}`);
            break;
          }
        }

        // 見つかった週に移動
        setWeekOffset(targetOffset);
        setNotionEvents(allWeeksCache[targetOffset] || []);

        // 前後週データも設定
        if (allWeeksCache[targetOffset - 1]) {
          setPrevWeekEvents(allWeeksCache[targetOffset - 1]);
        }
        if (allWeeksCache[targetOffset + 1]) {
          setNextWeekEvents(allWeeksCache[targetOffset + 1]);
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
  }, []); // 初回マウント時のみ実行

  const getBookingStatus = (date, time, eventsToCheck = null) => {
    const events = eventsToCheck || notionEvents;
    if (isHoliday(date)) {
      return 'holiday';
    }

    const dayOfWeek = date.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
    const timeHour = parseInt(time.split(':')[0]);

    // 火曜日11:00~16:00をブロック
    if (dayOfWeek === 2 && timeHour >= 11 && timeHour < 16) {
      return 'booked';
    }

    // 水曜日13:00のみブロック
    if (dayOfWeek === 3 && timeHour === 13) {
      return 'booked';
    }

    // 全日（火曜以外）15:00~16:00をブロック
    if (dayOfWeek !== 2 && timeHour >= 15 && timeHour < 16) {
      return 'booked';
    }

    const dateString = date.getFullYear() + '-' + 
                      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(date.getDate()).padStart(2, '0');

    const slotStart = new Date(`${dateString}T${time}:00+09:00`);
    const slotEnd = new Date(`${dateString}T${String(timeHour + 1).padStart(2, '0')}:00+09:00`);

    // 対面通話の前後3時間をブロック（通話方法が「対面」または名前に「対面」が含まれる）
    const hasBlockedTimeForInPerson = events.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;
      const callMethod = event.properties['通話方法']?.select?.name;
      const eventName = event.properties['名前']?.title?.[0]?.text?.content || '';

      if (!eventStart) return false;

      // 通話方法が「対面」または名前に「対面」が含まれる
      const isInPerson = callMethod === '対面' || eventName.includes('対面');
      if (!isInPerson) return false;

      const existingStart = new Date(eventStart);
      let existingEnd;

      if (eventEnd) {
        existingEnd = new Date(eventEnd);
      } else {
        existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);
      }

      const blockStart = new Date(existingStart.getTime() - 3 * 60 * 60 * 1000);
      const blockEnd = new Date(existingEnd.getTime() + 3 * 60 * 60 * 1000);

      const isBlocked = (blockStart <= slotEnd && blockEnd >= slotStart);
      return isBlocked;
    });

    if (hasBlockedTimeForInPerson) return 'booked';

    // 撮影の前はすべて（12:00から）・後は3時間をブロック（通話方法が「撮影」または名前に「撮影」が含まれる）
    const hasBlockedTimeForShooting = events.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;
      const callMethod = event.properties['通話方法']?.select?.name;
      const eventName = event.properties['名前']?.title?.[0]?.text?.content || '';

      if (!eventStart) return false;

      // 通話方法が「撮影」または名前に「撮影」が含まれる
      const isShooting = callMethod === '撮影' || eventName.includes('撮影');
      if (!isShooting) return false;

      const existingStart = new Date(eventStart);
      let existingEnd;

      if (eventEnd) {
        existingEnd = new Date(eventEnd);
      } else {
        existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);
      }

      // 12:00から撮影終了時刻まで + 後3時間をブロック
      const dayStart = new Date(existingStart);
      dayStart.setHours(12, 0, 0, 0);

      const blockStart = dayStart;
      const blockEnd = new Date(existingEnd.getTime() + 3 * 60 * 60 * 1000);

      const isBlocked = (blockStart <= slotEnd && blockEnd >= slotStart);
      return isBlocked;
    });

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
      alert('データを読み込み中です。しばらくお待ちください。');
      return;
    }

    if (isHoliday(date)) {
      alert('祝日は予約できません。他の日付を選択してください。');
      return;
    }

    if (getDateStatus(date) === 'full') {
      alert('選択した日付は満員です。他の日付を選択してください。');
      return;
    }

    setSelectedDate(date);
    setShowTimeSlots(true);
  };

  const handleTimeSelect = (time) => {
    if (isInitialLoading || isWeekChanging) {
      alert('データを読み込み中です。しばらくお待ちください。');
      return;
    }

    const status = getBookingStatus(selectedDate, time);
    if (status === 'available') {
      setSelectedTime(time);
      setShowTimeSlots(false);
      setShowBookingForm(true);
    } else {
      alert('選択した時間帯は予約できません。他の時間を選択してください。');
    }
  };

  const handleBooking = async () => {
    const latestEvents = await fetchNotionCalendar();

    if (isHoliday(selectedDate)) {
      alert('エラー: 祝日は予約できません。');
      setShowBookingForm(false);
      setShowTimeSlots(false);
      setSelectedDate(null);
      setSelectedTime(null);
      return;
    }

    const currentStatus = getBookingStatus(selectedDate, selectedTime, latestEvents);
    if (currentStatus !== 'available') {
      alert('エラー: 選択した時間帯は既に予約済みです。他の時間を選択してください。');
      setShowBookingForm(false);
      setSelectedTime(null);
      return;
    }

    setIsLoading(true);

    try {
      const bookingDataObj = {
        date: selectedDate.getFullYear() + '-' +
              String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' +
              String(selectedDate.getDate()).padStart(2, '0'),
        time: selectedTime,
        customerName: customerName,
        xLink: xLink,
        remarks: remarks,
        routeTag: routeTag,
        lineUserId: lineUserId || null
      };

      const success = await createNotionEvent(bookingDataObj);

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
          const selectedDateStr = selectedDate.toISOString().split('T')[0];
          const registeredDateStr = registeredDate.toISOString().split('T')[0];

          // 日付ズレ検知
          if (selectedDateStr !== registeredDateStr) {
            await sendChatWorkAlert({
              type: 'date_mismatch',
              data: {
                selectedDate: bookingDataObj.date,
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

        // LINE連携している場合は自動で通知を送信
        if (lineUserId) {
          try {
            const lineMessage = `【予約完了】\n\n日付: ${year}年${month}月${day}日 (${dayName})\n時間: ${selectedTime}\nお名前: ${customerName}\n\n予約が完了しました！\n担当者から折り返しご連絡いたします。`;

            await fetch('/.netlify/functions/line-notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: lineUserId,
                message: lineMessage
              })
            });
          } catch (error) {
            console.error('LINE通知送信エラー:', error);
            // LINE通知失敗しても予約は完了しているので、エラーを表示しない
          }
        }

        setShowBookingForm(false);
        setShowTimeSlots(false);
        setShowConfirmation(true);
      } else {
        alert('予約の作成に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('予約エラー:', error);
      
      // ネットワークエラーやデプロイ中の場合
      if (error.message.includes('fetch') || error.message.includes('NetworkError') || !navigator.onLine) {
        alert('ただいまサイト情報の更新中です。お手数をおかけいたしますが、数分後に再度お試しください。');
      } else {
        alert('予約の作成に失敗しました。もう一度お試しください。');
      }
    } finally {
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
    if (isHoliday(date)) return 'holiday';

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
    if (isHoliday(date)) return null;
    
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
    <div className="min-h-screen relative overflow-hidden overscroll-none touch-pan-y" style={{ overscrollBehavior: 'none' }}>
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
                  {settings.systemTitle}
                </h1>
                <p className="text-pink-600 text-xs sm:text-sm font-light tracking-wide">{settings.description}</p>
              </div>
            </div>

            {/* プログレスバー */}
            {(isLoading || isInitialLoading || isWeekChanging) && (
              <div className="h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-pulse"></div>
            )}
          </div>

          {/* メインコンテンツ */}
          <div className="p-1.5 sm:p-4 space-y-2 sm:space-y-4">
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
                    onClick={() => window.location.reload()}
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
              <div className="space-y-6 px-3 sm:px-0">
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setShowConfirmScreen(false);
                      setShowBookingForm(true);
                    }}
                    className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <h2 className="ml-3 sm:ml-4 text-lg sm:text-2xl font-bold text-gradient">予約内容の確認</h2>
                </div>

                <div className="glassmorphism rounded-xl sm:rounded-2xl p-3 sm:p-8 shadow-2xl">
                  {/* 共有案内（最上部） */}
                  <div className="mb-3 sm:mb-6 bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-300 rounded-lg sm:rounded-xl p-3 sm:p-6">
                    <div className="text-center">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 shadow-lg">
                        <i className="fas fa-share-alt text-white text-lg sm:text-2xl"></i>
                      </div>
                      <p className="text-base sm:text-lg text-pink-700 leading-relaxed font-bold">
                        予約情報は次ページより<br />担当者へお送りください
                      </p>
                    </div>
                  </div>

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

                    <div className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-200">
                      <span className="text-sm sm:text-base font-semibold text-gray-700 flex items-center">
                        <i className="fab fa-x-twitter mr-1.5 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                        Xリンク
                      </span>
                      <a
                        href={xLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm sm:text-lg font-bold text-blue-600 hover:text-blue-800 transition-colors break-all"
                      >
                        <i className="fas fa-external-link-alt mr-1 text-sm"></i>
                        リンクを開く
                      </a>
                    </div>

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

                <div className="flex space-x-2 sm:space-x-4">
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
              <div className="space-y-6 px-3 sm:px-0">
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

                    {/* 共有案内（最上部） */}
                    <div className="mb-3 sm:mb-6 bg-gradient-to-br from-pink-50 to-rose-50 border-2 sm:border-3 border-pink-300 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-xl">
                      <div className="text-center">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                          <i className="fas fa-share-alt text-white text-lg sm:text-2xl"></i>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-pink-700 mb-1.5 sm:mb-2">
                          予約情報は次ページより<br />担当者へお送りください
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
                              alert('予約情報をコピーしました！\n\nこの後XのDM画面が開きます。\nメッセージ入力欄に貼り付けて送信してください。');
                              window.open('https://x.com/messages/compose?recipient_id=1557882353845825536', '_blank');
                            }}
                            className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-black to-gray-800 text-white font-bold text-xs sm:text-base rounded-lg sm:rounded-xl shadow-lg active:scale-95 sm:hover:scale-105 transition-transform"
                          >
                            <i className="fab fa-x-twitter mr-1 sm:mr-2"></i>
                            Xで送る
                          </button>
                        </div>
                      </div>
                    </div>

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

                    {/* テストモード: LINE連携テストボタン */}
                    {isTestMode && (
                      <div className="mt-4 sm:mt-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl">
                        <div className="text-center mb-3">
                          <p className="text-sm font-bold text-yellow-800">🧪 テストモード専用機能</p>
                        </div>
                        <button
                          onClick={async () => {
                            const testUserId = prompt('テスト用LINE User IDを入力してください:\n\n※LINE公式アカウントの友だち追加が必要です');
                            if (!testUserId) return;

                            try {
                              const testMessage = `【予約完了テスト通知】\n\n日付: ${completedBooking.year}年${completedBooking.month}月${completedBooking.day}日 (${completedBooking.dayName})\n時間: ${completedBooking.time}\nお名前: ${completedBooking.customerName}\n\nこれはテスト通知です。\n実際の予約完了時にこのような通知が送信されます。`;

                              const response = await fetch('/.netlify/functions/line-notify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  userId: testUserId,
                                  message: testMessage
                                })
                              });

                              const result = await response.json();

                              if (response.ok) {
                                alert('✅ LINE通知送信成功！\n\nLINEアプリを確認してください。');
                              } else {
                                alert(`❌ LINE通知送信失敗\n\nエラー: ${result.error || '不明なエラー'}\n\n・LINE User IDが正しいか確認\n・友だち追加されているか確認\n・環境変数が設定されているか確認`);
                              }
                            } catch (error) {
                              alert(`❌ 送信エラー: ${error.message}`);
                            }
                          }}
                          className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
                        >
                          <i className="fab fa-line mr-2"></i>
                          LINE通知テスト送信
                        </button>
                      </div>
                    )}

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

            {!showTimeSlots && !showBookingForm && !showConfirmScreen && !showConfirmation && (
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
                      if (isHoliday(prevDate)) return 'holiday';
                      const availableSlots = timeSlots.filter(time =>
                        getBookingStatus(prevDate, time, prevWeekEvents) === 'available'
                      ).length;
                      if (availableSlots === 0) return 'full';
                      if (availableSlots <= 3) return 'few';
                      return 'available';
                    };

                    const getNextDateStatus = (idx) => {
                      const nextDate = getNextWeekDates()[idx];
                      if (isHoliday(nextDate)) return 'holiday';
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
                        if (isHoliday(prevDate)) {
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
                      const isDisabled = isInitialLoading || isWeekChanging || isHoliday(date) || status === 'full';

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(date)}
                          disabled={isDisabled}
                          className={`w-full p-1.5 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all duration-300 ${getDateCardClass(date)} ${isDisabled ? '' : 'active:scale-[0.98] sm:hover:scale-[1.02]'}`}
                        >
                            <div className="flex items-center">
                              <div className="text-center px-0 sm:px-3 w-16 sm:w-24 flex-shrink-0">
                                <div className="text-xs sm:text-sm font-medium text-gray-500">2025年</div>
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
                                {isHoliday(date) && (
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
                        if (isHoliday(nextDate)) {
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
              <div className="space-y-4 scale-100 px-3 sm:px-0" style={{ transformOrigin: 'top center' }}>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setShowTimeSlots(false);
                      setSelectedDate(null);
                    }}
                    className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110"
                  >
                    <i className="fas fa-arrow-left"></i>
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
              <div className="space-y-3 sm:space-y-6 px-3 sm:px-0">
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setShowBookingForm(false);
                      setShowTimeSlots(true);
                    }}
                    className="p-2 sm:p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg active:scale-95 sm:hover:shadow-xl transition-all duration-300 sm:hover:scale-110"
                  >
                    <i className="fas fa-arrow-left text-sm sm:text-base"></i>
                  </button>
                  <h2 className="ml-2 sm:ml-4 text-base sm:text-2xl font-bold text-gradient">予約情報入力</h2>
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
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fas fa-user mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      お名前 <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-sm sm:text-lg bg-white/80 backdrop-blur"
                      placeholder="お名前を入力してください"
                      required
                    />

                    {/* LINE連携ボタン */}
                    {!lineUserId && process.env.REACT_APP_LINE_CHANNEL_ID && (
                      <button
                        type="button"
                        onClick={() => {
                          const LINE_CHANNEL_ID = process.env.REACT_APP_LINE_CHANNEL_ID;
                          const REDIRECT_URI = encodeURIComponent('https://mfagencybooking.netlify.app/.netlify/functions/line-callback');
                          const STATE = Math.random().toString(36).substring(7);
                          const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${REDIRECT_URI}&state=${STATE}&scope=profile%20openid`;
                          console.log('LINE認証URL:', lineAuthUrl);
                          console.log('Channel ID:', LINE_CHANNEL_ID);
                          console.log('Redirect URI:', decodeURIComponent(REDIRECT_URI));
                          window.location.href = lineAuthUrl;
                        }}
                        className="mt-2 w-full py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all flex items-center justify-center text-sm sm:text-base"
                      >
                        <i className="fab fa-line mr-2"></i>
                        LINEと連携して名前を自動入力
                      </button>
                    )}

                    {/* LINE連携済み表示 */}
                    {lineUserId && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700 flex items-center">
                        <i className="fab fa-line mr-2"></i>
                        LINE連携済み（予約完了時に通知が届きます）
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5 sm:mb-3 flex items-center text-xs sm:text-base">
                      <i className="fab fa-x-twitter mr-1 sm:mr-2 text-purple-500 text-xs sm:text-base"></i>
                      Xリンク <span className="text-red-500 ml-1">*</span>
                    </label>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">（Xをお持ちでない場合はmyfansのリンクをご記入ください）</p>
                    <input
                      type="url"
                      value={xLink}
                      onChange={(e) => setXLink(e.target.value)}
                      className="w-full p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-sm sm:text-lg bg-white/80 backdrop-blur"
                      placeholder="https://x.com/username"
                      required
                    />
                  </div>

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
                        if (!customerName.trim() || !xLink.trim()) return;
                        setShowBookingForm(false);
                        setShowConfirmScreen(true);
                      }}
                      disabled={!customerName.trim() || !xLink.trim()}
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