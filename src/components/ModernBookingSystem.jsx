import React, { useState, useEffect, useRef } from 'react';

const ModernBookingSystem = () => {
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

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const pointersRef = useRef([]);
  const configRef = useRef({
    SPLAT_RADIUS: 0.3,
    SPLAT_FORCE: 6000,
    COLOR_PALETTE: [
      { r: 0.1, g: 0.3, b: 0.8 },
      { r: 0.8, g: 0.1, b: 0.5 },
      { r: 0.2, g: 0.8, b: 0.4 },
      { r: 0.9, g: 0.4, b: 0.1 },
      { r: 0.5, g: 0.1, b: 0.9 }
    ]
  });

  const settings = {
    immediateButtonText: 'BOOK NOW',
    startHour: 11,
    endHour: 21,
    systemTitle: 'NEXUS',
    description: 'AI-Powered Scheduling'
  };

  const holidays2025 = [
    '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23',
    '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04',
    '2025-05-05', '2025-07-21', '2025-08-11', '2025-09-15',
    '2025-09-23', '2025-10-13', '2025-11-03', '2025-11-23',
  ];

  const CALENDAR_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

  // Fluid simulation effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const ctx = canvas.getContext('2d');
    const particles = [];
    const mouse = { x: 0, y: 0 };

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = Math.random() * 100 + 50;
        this.color = configRef.current.COLOR_PALETTE[Math.floor(Math.random() * configRef.current.COLOR_PALETTE.length)];
        this.alpha = Math.random() * 0.3 + 0.1;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Mouse interaction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 200) {
          const force = (200 - distance) / 200;
          this.vx -= (dx / distance) * force * 0.5;
          this.vy -= (dy / distance) * force * 0.5;
        }

        // Boundary check
        if (this.x < -this.radius) this.x = canvas.width + this.radius;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = canvas.height + this.radius;
        if (this.y > canvas.height + this.radius) this.y = -this.radius;

        // Speed limit
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 3) {
          this.vx = (this.vx / speed) * 3;
          this.vy = (this.vy / speed) * 3;
        }
      }

      draw(ctx) {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, `rgba(${Math.floor(this.color.r * 255)}, ${Math.floor(this.color.g * 255)}, ${Math.floor(this.color.b * 255)}, ${this.alpha})`);
        gradient.addColorStop(1, `rgba(${Math.floor(this.color.r * 255)}, ${Math.floor(this.color.g * 255)}, ${Math.floor(this.color.b * 255)}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Initialize particles
    for (let i = 0; i < 15; i++) {
      particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height));
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.update();
        particle.draw(ctx);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleTouch = (e) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouch);

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouch);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + (weekOffset * 7));

    const weekDates = [];

    const isAugust30Week = () => {
      const august30 = new Date('2025-08-30');
      const weekStart = new Date(monday);
      const weekEnd = new Date(monday);
      weekEnd.setDate(monday.getDate() + 6);
      return august30 >= weekStart && august30 <= weekEnd;
    };

    const daysToShow = isAugust30Week() ? 6 : 5;

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const isHoliday = (date) => {
    const dateString = date.toISOString().split('T')[0];

    if (dateString === '2025-08-30') {
      return false;
    }

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
            property: '予定日',
            date: {
              on_or_after: datesForQuery[0].toISOString().split('T')[0],
              on_or_before: datesForQuery[4].toISOString().split('T')[0]
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Notion APIエラー');
      }

      const data = await response.json();
      setNotionEvents(data.results || []);

    } catch (error) {
      console.error('Notionカレンダーの取得に失敗:', error);
      setNotionEvents([]);
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
  }, []);

  const getBookingStatus = (date, time) => {
    if (isHoliday(date)) {
      return 'holiday';
    }

    const dateString = date.toISOString().split('T')[0];
    const timeHour = parseInt(time.split(':')[0]);

    const slotStart = new Date(`${dateString}T${time}:00+09:00`);
    const slotEnd = new Date(`${dateString}T${String(timeHour + 1).padStart(2, '0')}:00+09:00`);

    // Check for face-to-face appointments and block 2 hours before and after
    const hasBlockedTimeForInPerson = notionEvents.some(event => {
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

      // Block 2 hours before and after
      const blockStart = new Date(existingStart.getTime() - 2 * 60 * 60 * 1000);
      const blockEnd = new Date(existingEnd.getTime() + 2 * 60 * 60 * 1000);

      return (blockStart < slotEnd && blockEnd > slotStart);
    });

    if (hasBlockedTimeForInPerson) return 'booked';

    // Check for regular bookings
    const hasNotionEvent = notionEvents.some(event => {
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
      return;
    }

    if (isHoliday(date)) {
      return;
    }

    if (getDateStatus(date) === 'full') {
      return;
    }

    setSelectedDate(date);
    setShowTimeSlots(true);
  };

  const handleTimeSelect = (time) => {
    if (isInitialLoading || isWeekChanging) {
      return;
    }

    const status = getBookingStatus(selectedDate, time);
    if (status === 'available') {
      setSelectedTime(time);
      setShowBookingForm(true);
    }
  };

  const handleBooking = async () => {
    await fetchNotionCalendar();

    if (isHoliday(selectedDate)) {
      setShowBookingForm(false);
      setShowTimeSlots(false);
      setSelectedDate(null);
      setSelectedTime(null);
      return;
    }

    const currentStatus = getBookingStatus(selectedDate, selectedTime);
    if (currentStatus !== 'available') {
      setShowBookingForm(false);
      setSelectedTime(null);
      return;
    }

    setIsLoading(true);

    try {
      const bookingDataObj = {
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        customerName: customerName,
        xLink: xLink,
        remarks: remarks
      };

      const success = await createNotionEvent(bookingDataObj);

      if (success) {
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

        await fetchNotionCalendar();
      }
    } catch (error) {
      console.error('予約エラー:', error);
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
    return `${year}.${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}`;
  };

  const getDayName = (date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
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

  const getDateCardStyle = (date) => {
    const status = getDateStatus(date);
    const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();

    let background = 'rgba(255,255,255,0.03)';
    let border = '1px solid rgba(255,255,255,0.1)';
    let opacity = '1';
    let cursor = 'pointer';

    if (isSelected) {
      background = 'linear-gradient(135deg, rgba(100,200,255,0.2) 0%, rgba(150,100,255,0.2) 100%)';
      border = '1px solid rgba(100,200,255,0.5)';
    } else {
      switch (status) {
        case 'holiday':
          background = 'rgba(50,50,50,0.2)';
          border = '1px solid rgba(100,100,100,0.2)';
          opacity = '0.5';
          cursor = 'not-allowed';
          break;
        case 'full':
          background = 'rgba(255,50,50,0.1)';
          border = '1px solid rgba(255,100,100,0.2)';
          opacity = '0.7';
          cursor = 'not-allowed';
          break;
        case 'few':
          background = 'rgba(255,200,50,0.1)';
          border = '1px solid rgba(255,200,100,0.3)';
          break;
        case 'available':
          background = 'rgba(50,255,100,0.05)';
          border = '1px solid rgba(100,255,150,0.2)';
          break;
      }
    }

    return { background, border, opacity, cursor };
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'holiday': return { text: 'CLOSED', color: '#666' };
      case 'full': return { text: 'FULL', color: '#ff4444' };
      case 'few': return { text: 'LIMITED', color: '#ffaa00' };
      case 'available': return { text: 'AVAILABLE', color: '#00ff88' };
      default: return { text: 'AVAILABLE', color: '#00ff88' };
    }
  };

  return (
    <div className="min-h-screen relative" style={{ background: '#000' }}>
      {/* Fluid Background Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 1 }}
      />

      {/* Gradient Overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.7) 100%)',
        zIndex: 2
      }}></div>

      <div className="relative" style={{ zIndex: 10 }}>
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="py-8">
            <div className="text-center">
              <h1 className="text-6xl font-thin tracking-[0.2em] mb-2 text-white" style={{
                textShadow: '0 0 40px rgba(100,200,255,0.5)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                {settings.systemTitle}
              </h1>
              <p className="text-gray-500 text-xs font-light tracking-[0.4em] uppercase">
                {settings.description}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="pb-20">
            {/* Confirmation Screen */}
            {showConfirmation && completedBooking && (
              <div className="animate-fadeIn">
                <div className="rounded-3xl p-8" style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div className="text-center">
                    <div className="mb-8">
                      <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{
                        background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                        boxShadow: '0 0 50px rgba(0,255,136,0.5)'
                      }}>
                        <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>

                    <h2 className="text-3xl font-thin text-white mb-2 tracking-wider">BOOKING CONFIRMED</h2>
                    <p className="text-gray-500 text-sm mb-8">Your appointment has been successfully scheduled</p>

                    <div className="space-y-4 text-left max-w-md mx-auto">
                      <div className="flex justify-between py-3 border-b border-gray-800">
                        <span className="text-gray-500 text-sm uppercase tracking-wider">Date</span>
                        <span className="text-white font-light">
                          {completedBooking.year}.{String(completedBooking.month).padStart(2, '0')}.{String(completedBooking.day).padStart(2, '0')} ({completedBooking.dayName})
                        </span>
                      </div>

                      <div className="flex justify-between py-3 border-b border-gray-800">
                        <span className="text-gray-500 text-sm uppercase tracking-wider">Time</span>
                        <span className="text-white font-light">{completedBooking.time}</span>
                      </div>

                      <div className="flex justify-between py-3 border-b border-gray-800">
                        <span className="text-gray-500 text-sm uppercase tracking-wider">Name</span>
                        <span className="text-white font-light">{completedBooking.customerName}</span>
                      </div>

                      <div className="flex justify-between py-3 border-b border-gray-800">
                        <span className="text-gray-500 text-sm uppercase tracking-wider">Social</span>
                        <a href={completedBooking.xLink} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors font-light">
                          View Profile →
                        </a>
                      </div>

                      {completedBooking.remarks && (
                        <div className="pt-3">
                          <span className="text-gray-500 text-sm uppercase tracking-wider">Notes</span>
                          <p className="text-white font-light mt-2">{completedBooking.remarks}</p>
                        </div>
                      )}
                    </div>

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
                      className="mt-8 px-8 py-3 text-black font-light tracking-wider rounded-full transition-all duration-300 transform hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                        boxShadow: '0 4px 20px rgba(255,255,255,0.2)'
                      }}
                    >
                      RETURN HOME
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Date Selection */}
            {!showTimeSlots && !showBookingForm && !showConfirmation && (
              <div className="space-y-6 animate-fadeIn">
                {/* Week Navigation */}
                <div className="flex justify-between items-center mb-8">
                  <button
                    onClick={() => handleWeekChange(weekOffset - 1)}
                    disabled={isInitialLoading || isWeekChanging}
                    className="px-6 py-3 text-white font-light tracking-wider rounded-full transition-all duration-300 disabled:opacity-50"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    ← PREVIOUS
                  </button>

                  <div className="text-center">
                    <div className="text-2xl font-thin text-white tracking-wider">
                      {weekDates && weekDates.length > 0 ? `${formatDate(weekDates[0])} — ${formatDate(weekDates[weekDates.length - 1])}` : 'Loading...'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleWeekChange(weekOffset + 1)}
                    disabled={isInitialLoading || isWeekChanging}
                    className="px-6 py-3 text-white font-light tracking-wider rounded-full transition-all duration-300 disabled:opacity-50"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    NEXT →
                  </button>
                </div>

                {/* Date Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {weekDates.map((date, index) => {
                    const status = getDateStatus(date);
                    const statusInfo = getStatusIndicator(status);
                    const cardStyle = getDateCardStyle(date);
                    const isDisabled = isInitialLoading || isWeekChanging || isHoliday(date) || status === 'full';

                    return (
                      <button
                        key={index}
                        onClick={() => handleDateSelect(date)}
                        disabled={isDisabled}
                        className="group p-6 rounded-2xl transition-all duration-300 transform hover:scale-105"
                        style={{
                          ...cardStyle,
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="text-left">
                          <div className="text-3xl font-thin text-white mb-1">
                            {date.getDate().toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                            {getDayName(date)} • {formatFullDate(date)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-light tracking-wider" style={{ color: statusInfo.color }}>
                              {statusInfo.text}
                            </span>
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{
                              background: statusInfo.color,
                              boxShadow: `0 0 10px ${statusInfo.color}`
                            }}></div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time Selection */}
            {showTimeSlots && !showBookingForm && (
              <div className="animate-fadeIn">
                <button
                  onClick={() => {
                    setShowTimeSlots(false);
                    setSelectedDate(null);
                  }}
                  className="mb-6 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>

                <h2 className="text-2xl font-thin text-white mb-6 tracking-wider">
                  SELECT TIME • {formatFullDate(selectedDate)}
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {timeSlots.map((time) => {
                    const status = getBookingStatus(selectedDate, time);
                    const isAvailable = status === 'available';

                    return (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        disabled={!isAvailable}
                        className="p-4 rounded-xl transition-all duration-300 transform hover:scale-105"
                        style={{
                          background: isAvailable
                            ? 'rgba(0,255,136,0.1)'
                            : 'rgba(100,100,100,0.1)',
                          border: isAvailable
                            ? '1px solid rgba(0,255,136,0.3)'
                            : '1px solid rgba(100,100,100,0.2)',
                          opacity: isAvailable ? 1 : 0.5,
                          cursor: isAvailable ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <div className="text-xl font-light text-white">{time}</div>
                        <div className="text-xs mt-1" style={{
                          color: isAvailable ? '#00ff88' : '#666'
                        }}>
                          {isAvailable ? 'AVAILABLE' : 'BOOKED'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Booking Form */}
            {showBookingForm && (
              <div className="animate-fadeIn">
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedTime(null);
                  }}
                  className="mb-6 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>

                <div className="rounded-3xl p-8" style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <h2 className="text-2xl font-thin text-white mb-6 tracking-wider">CONFIRM BOOKING</h2>

                  <div className="mb-6 p-4 rounded-xl" style={{
                    background: 'rgba(100,200,255,0.1)',
                    border: '1px solid rgba(100,200,255,0.2)'
                  }}>
                    <div className="flex justify-between text-white">
                      <span className="text-sm text-gray-400">Date & Time</span>
                      <span className="font-light">
                        {formatFullDate(selectedDate)} • {selectedTime}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2 uppercase tracking-wider">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black/50 border border-gray-800 text-white focus:border-blue-500 focus:outline-none transition-colors"
                        placeholder="Enter your name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-2 uppercase tracking-wider">
                        X (Twitter) Link *
                      </label>
                      <input
                        type="url"
                        value={xLink}
                        onChange={(e) => setXLink(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black/50 border border-gray-800 text-white focus:border-blue-500 focus:outline-none transition-colors"
                        placeholder="https://x.com/username"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-2 uppercase tracking-wider">
                        Notes
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black/50 border border-gray-800 text-white focus:border-blue-500 focus:outline-none transition-colors resize-none"
                        placeholder="Any special requests or notes"
                        rows="3"
                      />
                    </div>

                    <div className="flex space-x-4 pt-4">
                      <button
                        onClick={() => setShowBookingForm(false)}
                        className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all duration-300"
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={handleBooking}
                        disabled={!customerName.trim() || !xLink.trim() || isLoading}
                        className="flex-1 py-3 rounded-xl text-black font-light tracking-wider transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: isLoading
                            ? 'linear-gradient(135deg, #666 0%, #444 100%)'
                            : 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                          boxShadow: '0 4px 20px rgba(0,255,136,0.3)'
                        }}
                      >
                        {isLoading ? 'PROCESSING...' : 'CONFIRM BOOKING'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {(isInitialLoading || isWeekChanging) && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="text-white text-center">
            <div className="w-16 h-16 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-400 uppercase tracking-wider">Loading...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ModernBookingSystem;