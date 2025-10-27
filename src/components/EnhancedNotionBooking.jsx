import React, { useState, useEffect, useRef } from 'react';
import FluidCanvas from './FluidCanvas';

const EnhancedNotionBooking = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [bookingData, setBookingData] = useState({});
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [xLink, setXLink] = useState('');
  const [remarks, setRemarks] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completedBooking, setCompletedBooking] = useState(null);

  const [notionEvents, setNotionEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isWeekChanging, setIsWeekChanging] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    healthy: true,
    message: '',
    lastChecked: null
  });

  // URLパラメータから経路タグを取得
  const [routeTag, setRouteTag] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref === 'personA') {
      setRouteTag('公認X');
    } else if (ref === 'personB') {
      setRouteTag('まゆ紹介or加藤');
    }
  }, []);


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

  const fetchNotionCalendar = async (isWeekChange = false, targetWeekDates = null) => {
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

      // データ検証
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

      setNotionEvents(fetchedEvents);
      setSystemStatus({
        healthy: true,
        message: '',
        lastChecked: new Date()
      });

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
          rich_text: [
            {
              text: {
                content: bookingData.routeTag
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

    await Promise.all([
      fetchNotionCalendar(true, newWeekDates),
      new Promise(resolve => {
        setWeekOffset(newOffset);
        resolve();
      })
    ]);
  };

  useEffect(() => {
    if (weekDates && weekDates.length > 0 && isInitialLoading) {
      fetchNotionCalendar(false);
    }
  }, [weekDates, isInitialLoading]);

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

    // 対面通話の前後3時間をブロック
    const hasBlockedTimeForInPerson = events.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;
      const callMethod = event.properties['通話方法']?.select?.name;

      if (!eventStart || callMethod !== '対面') return false;

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

    // 撮影の前はすべて・後は3時間をブロック
    const hasBlockedTimeForShooting = events.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;
      const callMethod = event.properties['通話方法']?.select?.name;

      if (!eventStart || callMethod !== '撮影') return false;

      const existingStart = new Date(eventStart);
      let existingEnd;

      if (eventEnd) {
        existingEnd = new Date(eventEnd);
      } else {
        existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);
      }

      const dayStart = new Date(existingStart);
      dayStart.setHours(0, 0, 0, 0);

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
        routeTag: routeTag
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
    <div className="min-h-screen relative">
      {/* Fluid Background Canvas */}
      <FluidCanvas />

      {/* Main Content */}
      <div className="relative" style={{ zIndex: 10, pointerEvents: 'none' }}>
        <div className="relative max-w-lg mx-auto" style={{ pointerEvents: 'auto' }}>
          {/* ヘッダー */}
          <div className="sticky top-0 z-50 shadow-2xl" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 192, 203, 0.3)'
          }}>
            <div className="p-3" style={{
              background: 'linear-gradient(135deg, rgba(255, 192, 203, 0.2), rgba(255, 218, 185, 0.2))'
            }}>
              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-wide mb-1 animate-float" style={{
                  background: 'linear-gradient(135deg, #ff69b4, #ff1493, #ff69b4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 20px rgba(255, 105, 180, 0.3)'
                }}>
                  <i className="fas fa-calendar-alt mr-2" style={{color: '#ff69b4'}}></i>
                  {settings.systemTitle}
                </h1>
                <p className="text-pink-600 text-xs font-light tracking-wide">{settings.description}</p>
              </div>
            </div>

            {/* プログレスバー */}
            {(isLoading || isInitialLoading || isWeekChanging) && (
              <div className="h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-pulse"></div>
            )}
          </div>

          {/* メインコンテンツ */}
          <div className="p-3 space-y-2">
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

            {/* 予約完了画面 */}
            {showConfirmation && completedBooking && (
              <div className="space-y-6">
                <div className="rounded-2xl p-8 shadow-2xl" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <div className="text-center">
                    <div className="mb-6">
                      <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-xl">
                        <i className="fas fa-check text-white text-5xl"></i>
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-black mb-4">予約が完了しました！</h2>
                    
                    <div className="bg-pink-100 border-2 border-pink-300 rounded-xl p-4 mb-6">
                      <p className="text-pink-600 text-2xl font-bold text-center">
                        この画面のスクリーンショットを<br />担当者までお送りください
                      </p>
                    </div>

                    <div className="space-y-4 text-left bg-white/50 backdrop-blur rounded-xl p-6 mt-6">
                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <span className="font-semibold text-gray-700 flex items-center">
                          <i className="fas fa-calendar-alt mr-2 text-purple-500"></i>
                          日付
                        </span>
                        <span className="text-lg font-bold text-gray-800">
                          {completedBooking.year}年{completedBooking.month}月{completedBooking.day}日 ({completedBooking.dayName})
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <span className="font-semibold text-gray-700 flex items-center">
                          <i className="fas fa-clock mr-2 text-purple-500"></i>
                          時間
                        </span>
                        <span className="text-lg font-bold text-gray-800">
                          {completedBooking.time}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <span className="font-semibold text-gray-700 flex items-center">
                          <i className="fas fa-user mr-2 text-purple-500"></i>
                          お名前
                        </span>
                        <span className="text-lg font-bold text-gray-800">
                          {completedBooking.customerName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <span className="font-semibold text-gray-700 flex items-center">
                          <i className="fab fa-x-twitter mr-2 text-purple-500"></i>
                          Xリンク
                        </span>
                        <a
                          href={completedBooking.xLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lg font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <i className="fas fa-external-link-alt mr-1 text-sm"></i>
                          リンクを開く
                        </a>
                      </div>

                      {completedBooking.remarks && (
                        <div className="py-3">
                          <span className="font-semibold text-gray-700 flex items-center mb-2">
                            <i className="fas fa-comment-dots mr-2 text-purple-500"></i>
                            備考
                          </span>
                          <p className="text-gray-800 bg-gray-50 rounded-lg p-3">
                            {completedBooking.remarks}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-8">
                      <button
                        onClick={() => {
                          setShowConfirmation(false);
                          setCompletedBooking(null);
                          setSelectedDate(null);
                          setSelectedTime(null);
                          setCustomerName('');
                          setXLink('');
                          setRemarks('');
                        }}
                        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105"
                      >
                        <i className="fas fa-home mr-2"></i>
                        トップに戻る
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!showTimeSlots && !showBookingForm && !showConfirmation && (
              <>
                {/* 週選択 */}
                <div className="rounded-2xl p-4 shadow-xl" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => handleWeekChange(weekOffset - 1)}
                      disabled={isInitialLoading || isWeekChanging}
                      className="group px-3 py-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transform transition-all duration-300 hover:-translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      <div className="text-center">
                        <div className="text-xs">前週</div>
                        <div className="text-sm">
                          <i className="fas fa-chevron-left group-hover:-translate-x-1 transition-transform"></i>
                        </div>
                      </div>
                    </button>

                    <div className="text-center">
                      <div className="text-lg font-bold text-gradient">
                        {weekDates && weekDates.length > 0 ? `${formatDate(weekDates[0])} - ${formatDate(weekDates[4])}` : '読み込み中...'}
                      </div>
                      <div className="text-xs text-gray-500 font-light">平日のみ表示</div>
                    </div>

                    <button
                      onClick={() => handleWeekChange(weekOffset + 1)}
                      disabled={isInitialLoading || isWeekChanging}
                      className="group px-3 py-1 bg-gradient-to-r from-pink-500 to-pink-400 text-white rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transform transition-all duration-300 hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      <div className="text-center">
                        <div className="text-xs">翌週</div>
                        <div className="text-sm">
                          <i className="fas fa-chevron-right group-hover:translate-x-1 transition-transform"></i>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 凡例 */}
                <div className="rounded-xl p-2 shadow-md" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 192, 203, 0.3)'
                }}>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">✅</span>
                      <span className="text-xs font-medium text-gray-700">空あり</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">⚠️</span>
                      <span className="text-xs font-medium text-gray-700">残少</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">❌</span>
                      <span className="text-xs font-medium text-gray-700">満員</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">🚫</span>
                      <span className="text-xs font-medium text-gray-700">休業</span>
                    </div>
                  </div>
                </div>

                {/* 日付選択 */}
                <div className="space-y-2">

                  {(isInitialLoading || isWeekChanging) && (
                    <div className="rounded-2xl p-8 text-center animate-pulse" style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 192, 203, 0.3)'
                    }}>
                      <div className="inline-block">
                        <div className="w-16 h-16 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gradient font-semibold">データを読み込んでいます...</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {weekDates.map((date, index) => {
                      const status = getDateStatus(date);
                      const isDisabled = isInitialLoading || isWeekChanging || isHoliday(date) || status === 'full';

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(date)}
                          disabled={isDisabled}
                          className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${getDateCardClass(date)} ${isDisabled ? '' : 'transform hover:scale-[1.02]'}`}
                        >
                          <div className="flex items-center">
                            <div className="text-left px-3">
                              <div className="text-sm font-medium text-gray-500">2025年</div>
                              <div className="text-lg font-bold text-gray-800">{formatDate(date)}</div>
                              <div className="text-sm font-medium text-gray-600 text-center">({getDayName(date)})</div>
                            </div>
                            <div className="flex-1 pl-6 pr-3">
                              {!isInitialLoading && !isWeekChanging && getTimeTableDisplay(date) && (
                                <div className="w-full">
                                  <div className="text-xs text-gray-700 font-medium text-center mb-1">
                                    ご予約可能な時間帯
                                  </div>
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
                </div>
              </>
            )}

            {/* 時間選択画面 */}
            {showTimeSlots && !showBookingForm && (
              <div className="space-y-4">
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
              <div className="space-y-6">
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setShowBookingForm(false);
                      setSelectedTime(null);
                    }}
                    className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <h2 className="ml-4 text-2xl font-bold text-gradient">予約情報入力</h2>
                </div>

                <div className="glassmorphism rounded-2xl p-6 shadow-xl">
                  <div className="text-lg font-bold text-purple-800 mb-3">予約内容確認</div>
                  <div className="space-y-2 text-gray-700">
                    <div className="flex items-center">
                      <i className="fas fa-calendar-alt mr-3 text-purple-500"></i>
                      {selectedDate && formatFullDate(selectedDate)} ({selectedDate && getDayName(selectedDate)})
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-clock mr-3 text-purple-500"></i>
                      {selectedTime}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-bold mb-3 flex items-center">
                      <i className="fas fa-user mr-2 text-purple-500"></i>
                      お名前 <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full p-4 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-lg bg-white/80 backdrop-blur"
                      placeholder="お名前を入力してください"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-3 flex items-center">
                      <i className="fab fa-x-twitter mr-2 text-purple-500"></i>
                      Xリンク <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="url"
                      value={xLink}
                      onChange={(e) => setXLink(e.target.value)}
                      className="w-full p-4 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-lg bg-white/80 backdrop-blur"
                      placeholder="https://x.com/username"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-3 flex items-center">
                      <i className="fas fa-comment-dots mr-2 text-purple-500"></i>
                      備考 <span className="text-gray-400 text-sm ml-2">(任意)</span>
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full p-4 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-all duration-300 text-lg bg-white/80 backdrop-blur resize-none"
                      placeholder="ご要望や連絡事項がありましたらご記入ください"
                      rows="3"
                    />
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => setShowBookingForm(false)}
                      className="flex-1 py-4 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-100 transition-all duration-300"
                    >
                      <i className="fas fa-times mr-2"></i>
                      キャンセル
                    </button>
                    <button
                      onClick={handleBooking}
                      disabled={!customerName.trim() || !xLink.trim() || isLoading}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                    >
                      {isLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          処理中...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check-circle mr-2"></i>
                          予約確定
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="mt-12 p-6 glassmorphism">
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                <i className="fas fa-info-circle mr-2"></i>
                予約は1時間単位です（平日のみ）
              </p>
              <p className="text-sm text-gray-600">
                <i className="fas fa-clock mr-2"></i>
                営業時間：{settings.startHour}:00 - {settings.endHour}:00
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedNotionBooking;