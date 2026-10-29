using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Threading;
using System.Runtime.InteropServices;
using System.Windows.Markup;
using WpfPath = System.Windows.Shapes.Path;
using WpfLine = System.Windows.Shapes.Line;
using WpfRectangle = System.Windows.Shapes.Rectangle;
using WpfEllipse = System.Windows.Shapes.Ellipse;

namespace StivieDesktop {
    public class StivieWindow : Window {
        private const double FullWidth = 340;
        private const double FullHeight = 490;
        private const double DockWidth = 48;
        private const double DockHeight = 58;
        private const double TuckedWidth = 10; // Solo 10px visibles contra el borde lateral en reposo

        private double currentDockY = -1;
        private bool isExpanded = false;
        private bool isAnimating = false;
        private bool isDragging = false;
        private Point dragStartPoint;
        private double dragStartTop;

        private Border panelExpanded;
        private Border panelDocked;
        private TextBlock txtSpeech;
        private ScrollViewer speechScroll;
        private TextBlock txtFeedback;
        private TextBox txtInput;
        private TextBlock txtPlaceholder;
        private Border inputContainer;
        private Button btnSend;

        private readonly string apiBase;
        private readonly string hostname;
        private readonly string username;
        private DispatcherTimer remotePollTimer;

        // Panel dinámico de opciones (predeterminadas / sub-menú por incidencia)
        private StackPanel actionsPanel;
        // Modo ticket: el siguiente mensaje del chat se registra como ticket de atención
        private bool ticketMode = false;
        private string pendingTicketCategory = "General";

        // ====================================================================
        // WIN32: CONFIGURACIÓN DE PANTALLAS (DUPLICACIÓN FORZADA REAL)
        // ====================================================================
        [DllImport("user32.dll")]
        private static extern int SetDisplayConfig(uint numPathArrayElements, IntPtr pathArray, uint numModeInfoArrayElements, IntPtr modeInfoArray, uint flags);

        [DllImport("user32.dll")]
        private static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPathArrayElements, out uint numModeInfoArrayElements);

        [DllImport("user32.dll")]
        private static extern int QueryDisplayConfig(uint flags, ref uint numPathArrayElements, IntPtr pathArray, ref uint numModeInfoArrayElements, IntPtr modeInfoArray, out uint currentTopologyId);

        private const uint SDC_TOPOLOGY_CLONE = 0x00000002;
        private const uint SDC_APPLY = 0x00000080;
        private const uint QDC_DATABASE_CURRENT = 0x00000004;
        private const uint TOPOLOGY_CLONE = 0x00000002;

        public StivieWindow(string serverUrl) {
            apiBase = string.IsNullOrEmpty(serverUrl) ? "https://tay-audit.pages.dev" : serverUrl.TrimEnd('/');
            hostname = Environment.MachineName;
            username = Environment.UserName;

            InitializeWindow();
            BuildInterface();
            SetupRemotePolling();
        }

        private HttpWebRequest CreateApiPostRequest(string path, int timeoutMs) {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(apiBase + path);
            req.Method = "POST";
            req.ContentType = "application/json; charset=utf-8";
            req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TayAudit-STIVIE/2.0";
            req.Accept = "application/json";
            req.Timeout = timeoutMs;
            return req;
        }

        private void InitializeWindow() {
            Title = "STIVIE - Asistente de Operaciones Virtual";
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            Topmost = true;
            ShowInTaskbar = false;
            ResizeMode = ResizeMode.NoResize;

            // Optimización de tipografía nativa ultra nítida (ClearType + Display mode)
            TextOptions.SetTextFormattingMode(this, TextFormattingMode.Display);
            TextOptions.SetTextRenderingMode(this, TextRenderingMode.ClearType);
            RenderOptions.SetClearTypeHint(this, ClearTypeHint.Enabled);

            // Inicia acoplado y oculto dentro del borde lateral derecho (solo asoman 10px)
            Rect workArea = SystemParameters.WorkArea;
            currentDockY = Math.Max(workArea.Top + 40, (workArea.Height / 2.0) - (DockHeight / 2.0));
            Width = DockWidth;
            Height = DockHeight;
            Left = workArea.Right - TuckedWidth; // Tucked en el borde
            Top = currentDockY;
        }

        private static Canvas CreateStylizedMascotCanvas(double size) {
            Canvas canvas = new Canvas {
                Width = size,
                Height = size,
                ClipToBounds = false
            };
            double scale = size / 32.0;
            canvas.RenderTransform = new ScaleTransform(scale, scale);

            // 1. Antena
            WpfLine antenna = new WpfLine {
                X1 = 16, Y1 = 2.5,
                X2 = 16, Y2 = 7,
                Stroke = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                StrokeThickness = 2,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round
            };
            canvas.Children.Add(antenna);

            // 2. Foco indicador de la antena (Cyan inteligente)
            WpfEllipse bulb = new WpfEllipse {
                Width = 4.5,
                Height = 4.5,
                Fill = new SolidColorBrush(Color.FromRgb(56, 189, 248)) // Cyan #38BDF8
            };
            Canvas.SetLeft(bulb, 13.75);
            Canvas.SetTop(bulb, 0.5);
            canvas.Children.Add(bulb);

            // 3. Pernos / Orejas cibernéticas laterales
            WpfRectangle leftEar = new WpfRectangle {
                Width = 2.6,
                Height = 6.5,
                RadiusX = 1.3,
                RadiusY = 1.3,
                Fill = new SolidColorBrush(Color.FromRgb(255, 184, 0))
            };
            Canvas.SetLeft(leftEar, 2.0);
            Canvas.SetTop(leftEar, 12.0);
            canvas.Children.Add(leftEar);

            WpfRectangle rightEar = new WpfRectangle {
                Width = 2.6,
                Height = 6.5,
                RadiusX = 1.3,
                RadiusY = 1.3,
                Fill = new SolidColorBrush(Color.FromRgb(255, 184, 0))
            };
            Canvas.SetLeft(rightEar, 27.4);
            Canvas.SetTop(rightEar, 12.0);
            canvas.Children.Add(rightEar);

            // 4. Chasis exterior de la cabeza
            WpfRectangle head = new WpfRectangle {
                Width = 23,
                Height = 19,
                RadiusX = 5.5,
                RadiusY = 5.5,
                Fill = new SolidColorBrush(Color.FromRgb(11, 19, 43)), // #0B132B
                Stroke = new SolidColorBrush(Color.FromRgb(255, 184, 0)), // #FFB800
                StrokeThickness = 2
            };
            Canvas.SetLeft(head, 4.5);
            Canvas.SetTop(head, 6.5);
            canvas.Children.Add(head);

            // 5. Pantalla visor cibernética
            WpfRectangle visor = new WpfRectangle {
                Width = 17,
                Height = 11,
                RadiusX = 3.5,
                RadiusY = 3.5,
                Fill = new SolidColorBrush(Color.FromRgb(7, 12, 30)), // #070C1E
                Stroke = new SolidColorBrush(Color.FromArgb(120, 56, 189, 248)),
                StrokeThickness = 0.8
            };
            Canvas.SetLeft(visor, 7.5);
            Canvas.SetTop(visor, 10.0);
            canvas.Children.Add(visor);

            // 6. Ojos cibernéticos luminosos
            WpfRectangle eyeLeft = new WpfRectangle {
                Width = 3.6,
                Height = 4.8,
                RadiusX = 1.8,
                RadiusY = 1.8,
                Fill = new SolidColorBrush(Color.FromRgb(56, 189, 248)) // Cyan #38BDF8
            };
            Canvas.SetLeft(eyeLeft, 10.5);
            Canvas.SetTop(eyeLeft, 12.2);
            canvas.Children.Add(eyeLeft);

            WpfRectangle eyeRight = new WpfRectangle {
                Width = 3.6,
                Height = 4.8,
                RadiusX = 1.8,
                RadiusY = 1.8,
                Fill = new SolidColorBrush(Color.FromRgb(56, 189, 248)) // Cyan #38BDF8
            };
            Canvas.SetLeft(eyeRight, 17.9);
            Canvas.SetTop(eyeRight, 12.2);
            canvas.Children.Add(eyeRight);

            // 7. Sonrisa amigable estilizada
            WpfPath smile = new WpfPath {
                Data = Geometry.Parse("M 13.5 17.8 Q 16 19.3 18.5 17.8"),
                Stroke = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                StrokeThickness = 1.3,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round
            };
            canvas.Children.Add(smile);

            return canvas;
        }

        private static Style CreateModernScrollBarStyle() {
            string xaml = @"<Style xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='ScrollBar'>
                <Setter Property='Width' Value='5'/>
                <Setter Property='MinWidth' Value='5'/>
                <Setter Property='Background' Value='Transparent'/>
                <Setter Property='Template'>
                    <Setter.Value>
                        <ControlTemplate TargetType='ScrollBar'>
                            <Grid Background='Transparent'>
                                <Track Name='PART_Track' IsDirectionReversed='True'>
                                    <Track.Thumb>
                                        <Thumb>
                                            <Thumb.Template>
                                                <ControlTemplate TargetType='Thumb'>
                                                    <Border CornerRadius='2.5' Background='#475569' Margin='0,1,0,1'/>
                                                </ControlTemplate>
                                            </Thumb.Template>
                                        </Thumb>
                                    </Track.Thumb>
                                </Track>
                            </Grid>
                        </ControlTemplate>
                    </Setter.Value>
                </Setter>
            </Style>";
            return (Style)XamlReader.Parse(xaml);
        }

        private static ControlTemplate CreateRoundedButtonTemplate(double cornerRadius) {
            string xaml = @"<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='Button'>
                <Border Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='" + cornerRadius.ToString(CultureInfo.InvariantCulture) + @"' SnapsToDevicePixels='True'>
                    <ContentPresenter HorizontalAlignment='{TemplateBinding HorizontalContentAlignment}' VerticalAlignment='{TemplateBinding VerticalContentAlignment}' Margin='{TemplateBinding Padding}' RecognizesAccessKey='True'/>
                </Border>
            </ControlTemplate>";
            return (ControlTemplate)XamlReader.Parse(xaml);
        }

        private void BuildInterface() {
            Grid root = new Grid();

            // ====================================================================
            // 1. PANEL EXPANDIDO (VENTANA DE ASISTENCIA TÉCNICA)
            // ====================================================================
            panelExpanded = new Border {
                Width = FullWidth,
                Height = FullHeight,
                Background = new SolidColorBrush(Color.FromRgb(11, 19, 43)), // #0B132B
                BorderBrush = new SolidColorBrush(Color.FromRgb(255, 184, 0)), // #FFB800 UPN Oro
                BorderThickness = new Thickness(1.8),
                CornerRadius = new CornerRadius(14),
                Visibility = Visibility.Collapsed,
                Opacity = 0.0
            };

            Grid expandedGrid = new Grid { Margin = new Thickness(14) };
            expandedGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 0: Header
            expandedGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // 1: Speech Scrollable
            expandedGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 2: Actions
            expandedGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 3: Feedback
            expandedGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // 4: Chat input

            // HEADER: Drag Area + Logo + Clean Branding
            Grid header = new Grid { Cursor = Cursors.SizeAll, Margin = new Thickness(0, 0, 0, 10), Background = Brushes.Transparent };
            header.MouseLeftButtonDown += (s, e) => {
                if (e.ButtonState == MouseButtonState.Pressed) DragMove();
            };
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            StackPanel brandStack = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };

            // Logo Icon Badge con mascota STIVIE estilizada
            Border logoBadge = new Border {
                Width = 34,
                Height = 34,
                CornerRadius = new CornerRadius(8),
                Background = new SolidColorBrush(Color.FromRgb(11, 19, 43)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                BorderThickness = new Thickness(1.5),
                Margin = new Thickness(0, 0, 8, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            Canvas headerMascot = CreateStylizedMascotCanvas(26);
            headerMascot.HorizontalAlignment = HorizontalAlignment.Center;
            headerMascot.VerticalAlignment = VerticalAlignment.Center;
            logoBadge.Child = headerMascot;
            brandStack.Children.Add(logoBadge);

            StackPanel titleStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            titleStack.Children.Add(new TextBlock {
                Text = "STIVIE",
                FontWeight = FontWeights.Bold,
                FontSize = 14.5,
                Foreground = Brushes.White,
                FontFamily = new FontFamily("Segoe UI")
            });
            titleStack.Children.Add(new TextBlock {
                Text = "Asistente de Operaciones Virtual",
                FontSize = 10,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                FontFamily = new FontFamily("Segoe UI")
            });
            brandStack.Children.Add(titleStack);
            Grid.SetColumn(brandStack, 0);
            header.Children.Add(brandStack);

            // Botón Cerrar (Con esquinas redondeadas circulares y deslizamiento suave al lateral)
            Button btnClose = new Button {
                Width = 26,
                Height = 26,
                Background = new SolidColorBrush(Color.FromRgb(239, 68, 68)),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                ToolTip = "Ocultar STIVIE al lateral de la pantalla",
                Template = CreateRoundedButtonTemplate(13) // Redondeado circular
            };
            Canvas xCanvas = new Canvas { Width = 10, Height = 10, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
            xCanvas.Children.Add(new WpfLine { X1 = 1, Y1 = 1, X2 = 9, Y2 = 9, Stroke = Brushes.White, StrokeThickness = 1.8 });
            xCanvas.Children.Add(new WpfLine { X1 = 9, Y1 = 1, X2 = 1, Y2 = 9, Stroke = Brushes.White, StrokeThickness = 1.8 });
            btnClose.Content = xCanvas;
            btnClose.MouseEnter += (s, e) => {
                btnClose.Background = new SolidColorBrush(Color.FromRgb(248, 113, 113));
            };
            btnClose.MouseLeave += (s, e) => {
                btnClose.Background = new SolidColorBrush(Color.FromRgb(239, 68, 68));
            };
            btnClose.Click += (s, e) => DockToSide();
            Grid.SetColumn(btnClose, 1);
            header.Children.Add(btnClose);
            Grid.SetRow(header, 0);
            expandedGrid.Children.Add(header);

            // SPEECH BUBBLE: Tipografía de máxima legibilidad y Scrollbar moderno 5px
            Border speechBorder = new Border {
                Background = new SolidColorBrush(Color.FromRgb(17, 28, 48)), // #111C30
                BorderBrush = new SolidColorBrush(Color.FromArgb(140, 42, 59, 92)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(14, 12, 12, 12),
                Margin = new Thickness(0, 0, 0, 8)
            };
            txtSpeech = new TextBlock {
                Text = string.Format("¡Hola {0}! Soy STIVIE, tu Asistente de Operaciones Virtual. Tengo herramientas directas y soporte inteligente para resolver cualquier requerimiento en tu equipo.", username),
                TextWrapping = TextWrapping.Wrap,
                Foreground = Brushes.White, // Blanco puro 100% de alto contraste
                FontSize = 12.5,
                FontWeight = FontWeights.Normal,
                LineHeight = 20,
                FontFamily = new FontFamily("Segoe UI")
            };
            speechScroll = new ScrollViewer {
                MaxHeight = 175,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                Content = txtSpeech,
                Padding = new Thickness(0, 2, 6, 2)
            };
            try {
                speechScroll.Resources.Add(typeof(ScrollBar), CreateModernScrollBarStyle());
            } catch { }
            speechBorder.Child = speechScroll;
            Grid.SetRow(speechBorder, 1);
            expandedGrid.Children.Add(speechBorder);

            // ACTIONS STACK: Opciones Predeterminadas con botones redondeados
            actionsPanel = new StackPanel { Margin = new Thickness(0, 0, 0, 6) };
            ShowDefaultOptions();
            Grid.SetRow(actionsPanel, 2);
            expandedGrid.Children.Add(actionsPanel);

            // FEEDBACK TEXT
            txtFeedback = new TextBlock {
                Text = "",
                FontSize = 10,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(56, 189, 248)), // #38BDF8
                Margin = new Thickness(0, 0, 0, 4),
                TextAlignment = TextAlignment.Center,
                FontFamily = new FontFamily("Segoe UI")
            };
            Grid.SetRow(txtFeedback, 3);
            expandedGrid.Children.Add(txtFeedback);

            // CHAT INPUT ROW: Campo con esquinas redondeadas + Placeholder + Botón Consultar redondeado
            Grid inputGrid = new Grid();
            inputGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            inputGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // Campo con esquinas redondeadas (CornerRadius = 10)
            inputContainer = new Border {
                Background = new SolidColorBrush(Color.FromRgb(17, 28, 48)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                BorderThickness = new Thickness(1.5),
                CornerRadius = new CornerRadius(10),
                Height = 36,
                ClipToBounds = true
            };

            Grid innerInputGrid = new Grid();

            txtPlaceholder = new TextBlock {
                Text = "Escribe tu problema o consulta...",
                Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
                FontSize = 11.5,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(12, 0, 12, 0),
                IsHitTestVisible = false,
                FontFamily = new FontFamily("Segoe UI")
            };
            innerInputGrid.Children.Add(txtPlaceholder);

            txtInput = new TextBox {
                Background = Brushes.Transparent,
                Foreground = Brushes.White,
                CaretBrush = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                BorderThickness = new Thickness(0),
                FontSize = 11.5,
                Padding = new Thickness(12, 0, 12, 0),
                VerticalContentAlignment = VerticalAlignment.Center,
                FontFamily = new FontFamily("Segoe UI")
            };
            txtInput.GotFocus += (s, e) => {
                inputContainer.BorderBrush = new SolidColorBrush(Color.FromRgb(255, 184, 0));
            };
            txtInput.LostFocus += (s, e) => {
                inputContainer.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));
            };
            txtInput.TextChanged += (s, e) => {
                txtPlaceholder.Visibility = string.IsNullOrEmpty(txtInput.Text) ? Visibility.Visible : Visibility.Collapsed;
            };
            txtInput.KeyDown += (s, e) => {
                if (e.Key == Key.Enter) SendChatMessage();
            };
            innerInputGrid.Children.Add(txtInput);
            inputContainer.Child = innerInputGrid;

            Grid.SetColumn(inputContainer, 0);
            inputGrid.Children.Add(inputContainer);

            // Botón Consultar con esquinas redondeadas (CornerRadius = 10)
            btnSend = new Button {
                Content = "Consultar",
                Height = 36,
                Padding = new Thickness(14, 0, 14, 0),
                Margin = new Thickness(6, 0, 0, 0),
                Background = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                Foreground = new SolidColorBrush(Color.FromRgb(11, 19, 43)),
                FontWeight = FontWeights.Bold,
                FontSize = 11.5,
                Cursor = Cursors.Hand,
                BorderThickness = new Thickness(0),
                FontFamily = new FontFamily("Segoe UI"),
                Template = CreateRoundedButtonTemplate(10) // Botón con esquinas redondeadas
            };
            btnSend.MouseEnter += (s, e) => {
                btnSend.Background = new SolidColorBrush(Color.FromRgb(255, 204, 51));
            };
            btnSend.MouseLeave += (s, e) => {
                btnSend.Background = new SolidColorBrush(Color.FromRgb(255, 184, 0));
            };
            btnSend.Click += (s, e) => SendChatMessage();
            Grid.SetColumn(btnSend, 1);
            inputGrid.Children.Add(btnSend);
            Grid.SetRow(inputGrid, 4);
            expandedGrid.Children.Add(inputGrid);

            panelExpanded.Child = expandedGrid;
            root.Children.Add(panelExpanded);

            // ====================================================================
            // 2. PANEL DOCKED (PESTAÑA LATERAL OCULTA AL BORDE DE LA PANTALLA)
            // ====================================================================
            panelDocked = new Border {
                Width = DockWidth,
                Height = DockHeight,
                Background = new SolidColorBrush(Color.FromRgb(11, 19, 43)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                BorderThickness = new Thickness(2.4, 2.4, 0, 2.4),
                CornerRadius = new CornerRadius(14, 0, 0, 14), // Curvado hacia adentro, plano contra el borde
                Visibility = Visibility.Visible,
                Opacity = 1.0,
                Cursor = Cursors.Hand,
                ToolTip = "STIVIE - Asistente de Operaciones Virtual (Pasa el cursor para ver)"
            };

            // Mascota STIVIE estilizada con trazos vectoriales limpios
            Canvas dockMascot = CreateStylizedMascotCanvas(32);
            dockMascot.HorizontalAlignment = HorizontalAlignment.Center;
            dockMascot.VerticalAlignment = VerticalAlignment.Center;
            panelDocked.Child = dockMascot;

            // Arrastre vertical de la pestaña (SIEMPRE anclada al borde lateral derecho)
            panelDocked.PreviewMouseLeftButtonDown += (s, e) => {
                isDragging = false;
                dragStartPoint = e.GetPosition(this);
                dragStartTop = Top;
                panelDocked.CaptureMouse();
            };

            panelDocked.PreviewMouseMove += (s, e) => {
                if (e.LeftButton == MouseButtonState.Pressed && panelDocked.IsMouseCaptured) {
                    Point current = e.GetPosition(this);
                    double deltaY = current.Y - dragStartPoint.Y;
                    if (Math.Abs(deltaY) > 4) {
                        isDragging = true;
                        Rect wa = SystemParameters.WorkArea;
                        double newTop = Math.Max(wa.Top + 10, Math.Min(wa.Bottom - DockHeight - 10, dragStartTop + deltaY));
                        Top = newTop;
                        Left = wa.Right - DockWidth; // Se mantiene completamente visible mientras se arrastra
                        currentDockY = newTop;
                    }
                }
            };

            panelDocked.PreviewMouseLeftButtonUp += (s, e) => {
                panelDocked.ReleaseMouseCapture();
                if (!isDragging) {
                    Expand();
                }
                isDragging = false;
            };

            // Hover: cuando el cursor pasa sobre el borde, STIVIE sale suavemente de su escondite
            panelDocked.MouseEnter += (s, e) => {
                if (!isExpanded && !isDragging) {
                    panelDocked.BorderBrush = new SolidColorBrush(Color.FromRgb(255, 215, 0));
                    PeekOut();
                }
            };

            // Cuando el cursor sale, STIVIE se vuelve a ocultar en el lateral de la pantalla
            panelDocked.MouseLeave += (s, e) => {
                if (!isExpanded && !isDragging) {
                    panelDocked.BorderBrush = new SolidColorBrush(Color.FromRgb(255, 184, 0));
                    TuckIn();
                }
            };

            root.Children.Add(panelDocked);
            Content = root;
        }

        private Button CreateActionButton(string title, Action onClick) {
            Button btn = new Button {
                Content = title,
                Height = 32,
                Margin = new Thickness(0, 0, 0, 5),
                Background = new SolidColorBrush(Color.FromRgb(22, 35, 59)),
                Foreground = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(140, 255, 184, 0)),
                BorderThickness = new Thickness(1),
                FontSize = 11,
                FontWeight = FontWeights.SemiBold,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                Padding = new Thickness(12, 0, 12, 0),
                Cursor = Cursors.Hand,
                FontFamily = new FontFamily("Segoe UI"),
                Template = CreateRoundedButtonTemplate(8) // Botón de acción con esquinas redondeadas
            };
            btn.MouseEnter += (s, e) => {
                btn.Background = new SolidColorBrush(Color.FromRgb(32, 49, 82));
                btn.BorderBrush = new SolidColorBrush(Color.FromRgb(255, 215, 0));
            };
            btn.MouseLeave += (s, e) => {
                btn.Background = new SolidColorBrush(Color.FromRgb(22, 35, 59));
                btn.BorderBrush = new SolidColorBrush(Color.FromArgb(140, 255, 184, 0));
            };
            btn.Click += (s, e) => onClick();
            return btn;
        }

        // ====================================================================
        // TRANSICIONES SUAVES NATIVAS (AUTO-OCULTAR Y SALIR AL PASAR EL CURSOR)
        // ====================================================================
        private void PeekOut() {
            if (isExpanded || isAnimating) return;
            Rect wa = SystemParameters.WorkArea;
            double targetLeft = wa.Right - DockWidth;
            if (Math.Abs(Left - targetLeft) < 1) return;

            DoubleAnimation slideOut = new DoubleAnimation {
                From = Left,
                To = targetLeft,
                Duration = TimeSpan.FromMilliseconds(130),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
                FillBehavior = FillBehavior.Stop
            };
            slideOut.Completed += (s, e) => {
                this.BeginAnimation(Window.LeftProperty, null);
                this.Left = targetLeft;
            };
            this.BeginAnimation(Window.LeftProperty, slideOut);
        }

        private void TuckIn() {
            if (isExpanded || isAnimating || isDragging) return;
            Rect wa = SystemParameters.WorkArea;
            double targetLeft = wa.Right - TuckedWidth;
            if (Math.Abs(Left - targetLeft) < 1) return;

            DoubleAnimation slideIn = new DoubleAnimation {
                From = Left,
                To = targetLeft,
                Duration = TimeSpan.FromMilliseconds(160),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn },
                FillBehavior = FillBehavior.Stop
            };
            slideIn.Completed += (s, e) => {
                this.BeginAnimation(Window.LeftProperty, null);
                this.Left = targetLeft;
            };
            this.BeginAnimation(Window.LeftProperty, slideIn);
        }

        public void DockToSide() {
            if (isAnimating || !isExpanded) return;
            isAnimating = true;

            Rect wa = SystemParameters.WorkArea;
            currentDockY = Math.Max(wa.Top + 20, Math.Min(wa.Bottom - DockHeight - 20, Top + 40));
            // Al cerrar, se oculta directamente dentro del lateral de la pantalla
            double targetLeft = wa.Right - TuckedWidth;

            DoubleAnimation slide = new DoubleAnimation {
                From = Left,
                To = targetLeft,
                Duration = TimeSpan.FromMilliseconds(200),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn },
                FillBehavior = FillBehavior.Stop
            };

            DoubleAnimation fade = new DoubleAnimation {
                From = 1.0,
                To = 0.0,
                Duration = TimeSpan.FromMilliseconds(180),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn },
                FillBehavior = FillBehavior.Stop
            };

            slide.Completed += (s, e) => {
                // Liberar cualquier reloj de animación
                this.BeginAnimation(Window.LeftProperty, null);
                this.Left = targetLeft;
                this.Top = currentDockY;
                this.Width = DockWidth;
                this.Height = DockHeight;

                panelExpanded.Visibility = Visibility.Collapsed;
                panelExpanded.Opacity = 0.0;

                // Mostrar pestaña lateral anclada y metida en el borde
                panelDocked.Visibility = Visibility.Visible;
                panelDocked.Opacity = 1.0;

                isExpanded = false;
                isAnimating = false;
            };

            panelExpanded.BeginAnimation(UIElement.OpacityProperty, fade);
            this.BeginAnimation(Window.LeftProperty, slide);
        }

        public void Expand() {
            if (isAnimating || isExpanded) return;
            isAnimating = true;

            Rect wa = SystemParameters.WorkArea;
            double targetLeft = wa.Right - FullWidth - 8;
            double startLeft = wa.Right - DockWidth;
            double targetTop = Math.Max(wa.Top + 10, Math.Min(wa.Bottom - FullHeight - 10, Top - 50));

            // Ocultar pestaña lateral y preparar panel expandido
            panelDocked.Visibility = Visibility.Collapsed;
            panelDocked.Opacity = 0.0;

            this.Width = FullWidth;
            this.Height = FullHeight;
            this.Left = startLeft;
            this.Top = targetTop;

            panelExpanded.Visibility = Visibility.Visible;
            panelExpanded.Opacity = 1.0;

            // Deslizamiento suave hacia la izquierda abriendo la ventana
            DoubleAnimation slide = new DoubleAnimation {
                From = startLeft,
                To = targetLeft,
                Duration = TimeSpan.FromMilliseconds(210),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
                FillBehavior = FillBehavior.Stop
            };

            slide.Completed += (s, e) => {
                this.BeginAnimation(Window.LeftProperty, null);
                this.Left = targetLeft;
                isExpanded = true;
                isAnimating = false;
            };

            this.BeginAnimation(Window.LeftProperty, slide);
        }

        // ====================================================================
        // ACCIONES PREDETERMINADAS DE SOPORTE TI
        // ====================================================================

        private TextBlock CreateSectionHeader(string text) {
            return new TextBlock {
                Text = text,
                FontSize = 9.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(255, 184, 0)),
                Margin = new Thickness(0, 0, 0, 4),
                FontFamily = new FontFamily("Segoe UI")
            };
        }

        // Menú principal: 3 opciones predeterminadas + creación de ticket
        private void ShowDefaultOptions() {
            actionsPanel.Children.Clear();
            actionsPanel.Children.Add(CreateSectionHeader("OPCIONES PREDETERMINADAS:"));
            actionsPanel.Children.Add(CreateActionButton("📺 No se proyecta la pantalla", () => ShowScreenOptions()));
            actionsPanel.Children.Add(CreateActionButton("🔊 Tengo problemas con el audio", () => ShowAudioOptions()));
            actionsPanel.Children.Add(CreateActionButton("⚡ El equipo está lento", () => ShowPerformanceOptions()));
            actionsPanel.Children.Add(CreateActionButton("🎫 Crear ticket de atención", () => StartTicketMode("General")));
        }

        // Sub-menú por incidencia: solución directa + llamar a un técnico (ticket)
        private void ShowIssueOptions(string title, string fixLabel, Action fix, string category, string ticketDescription) {
            ExitTicketMode();
            actionsPanel.Children.Clear();
            actionsPanel.Children.Add(CreateSectionHeader(title));
            actionsPanel.Children.Add(CreateActionButton(fixLabel, fix));
            actionsPanel.Children.Add(CreateActionButton("📞 Llamar a un técnico", () => CreateSupportTicket(category, ticketDescription, "alta")));
            Button back = CreateActionButton("← Volver a opciones", () => {
                ShowDefaultOptions();
                txtFeedback.Text = "";
                txtSpeech.Text = "¿En qué más puedo ayudarte? Elige una opción o escribe tu consulta.";
            });
            back.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));
            actionsPanel.Children.Add(back);
        }

        private void ShowScreenOptions() {
            txtFeedback.Text = "";
            txtSpeech.Text = "Entiendo, tu pantalla no se proyecta. Puedo forzar ahora mismo la duplicación de pantalla hacia el proyector, o generar un ticket para que un técnico venga a atenderte.";
            speechScroll.ScrollToTop();
            ShowIssueOptions("NO SE PROYECTA LA PANTALLA:", "🖥 Duplicar pantalla", () => ExecuteScreenTroubleshoot(),
                "Pantalla / Proyector", "No se proyecta la pantalla en el proyector. Solicitado desde STIVIE.");
        }

        private void ShowAudioOptions() {
            txtFeedback.Text = "";
            txtSpeech.Text = "Entiendo, tienes problemas con el audio. Puedo reiniciar los servicios de sonido de Windows, o generar un ticket para que un técnico te atienda.";
            speechScroll.ScrollToTop();
            ShowIssueOptions("PROBLEMAS CON EL AUDIO:", "🔊 Reparar audio", () => ExecuteAudioTroubleshoot(),
                "Audio / Sonido", "El equipo presenta problemas con el audio. Solicitado desde STIVIE.");
        }

        private void ShowPerformanceOptions() {
            txtFeedback.Text = "";
            txtSpeech.Text = "Entiendo, el equipo está lento: se cuelga, tarda en abrir programas o las páginas tardan en cargar. Puedo optimizarlo ahora mismo (cerrar programas colgados, limpiar temporales, renovar DNS y revisar internet), o generar un ticket para que un técnico lo revise.";
            speechScroll.ScrollToTop();
            ShowIssueOptions("EL EQUIPO ESTÁ LENTO / RENDIMIENTO:", "🚀 Optimizar equipo", () => ExecutePerformanceTroubleshoot(),
                "Rendimiento / Lentitud", "El equipo está lento: lentitud, se cuelga o las páginas tardan en cargar. Solicitado desde STIVIE.");
        }

        // Lee la topología de pantallas activa (1=interna, 2=duplicada, 4=extendida, 8=externa, 0=desconocida)
        private static uint GetCurrentTopology() {
            try {
                uint numPath, numMode;
                if (GetDisplayConfigBufferSizes(QDC_DATABASE_CURRENT, out numPath, out numMode) != 0) return 0;
                IntPtr pathBuf = Marshal.AllocHGlobal((int)Math.Max(1, numPath) * 72); // sizeof(DISPLAYCONFIG_PATH_INFO)
                IntPtr modeBuf = Marshal.AllocHGlobal((int)Math.Max(1, numMode) * 64); // sizeof(DISPLAYCONFIG_MODE_INFO)
                try {
                    uint topology;
                    int r = QueryDisplayConfig(QDC_DATABASE_CURRENT, ref numPath, pathBuf, ref numMode, modeBuf, out topology);
                    return r == 0 ? topology : 0;
                } finally {
                    Marshal.FreeHGlobal(pathBuf);
                    Marshal.FreeHGlobal(modeBuf);
                }
            } catch {
                return 0;
            }
        }

        private static bool IsCloneActive(int lastApiResult) {
            uint t = GetCurrentTopology();
            return t == TOPOLOGY_CLONE || (t == 0 && lastApiResult == 0);
        }

        // Duplicación forzada: API nativa SetDisplayConfig + verificación + respaldos DisplaySwitch
        private static string ForceCloneDisplay() {
            if (GetCurrentTopology() == TOPOLOGY_CLONE) return "already";

            // 1) API Win32 directa (equivalente a Win+P > Duplicar, sin interfaz)
            int apiResult = SetDisplayConfig(0, IntPtr.Zero, 0, IntPtr.Zero, SDC_APPLY | SDC_TOPOLOGY_CLONE);
            Thread.Sleep(1200);
            if (IsCloneActive(apiResult)) return "ok";

            // 2) DisplaySwitch.exe con ruta absoluta: sintaxis clásica (/clone) y Windows 11 24H2+ (2)
            string ds = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "DisplaySwitch.exe");
            foreach (string arg in new[] { "/clone", "2" }) {
                try {
                    Process p = Process.Start(new ProcessStartInfo {
                        FileName = ds,
                        Arguments = arg,
                        UseShellExecute = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    });
                    if (p != null) p.WaitForExit(4000);
                } catch { }
                Thread.Sleep(1500);
                if (GetCurrentTopology() == TOPOLOGY_CLONE) return "ok";
            }
            return "fail";
        }

        // 1. No se proyecta la pantalla -> Duplicar pantalla (forzado)
        private void ExecuteScreenTroubleshoot() {
            txtFeedback.Text = "Forzando duplicación de pantalla...";
            ThreadPool.QueueUserWorkItem((state) => {
                string result = "fail";
                try { result = ForceCloneDisplay(); } catch { }
                Dispatcher.Invoke((Action)(() => {
                    if (result == "ok" || result == "already") {
                        txtFeedback.Text = "[OK] Pantalla duplicada en el proyector";
                        txtSpeech.Text = (result == "already" ? "Tu pantalla ya estaba en modo Duplicar. " : "Listo, he forzado el modo Duplicar pantalla. ") +
                            "Si el proyector sigue sin imagen, verifica que el cable HDMI/VGA esté bien conectado y que el proyector esté en la fuente correcta. Si no se soluciona, pulsa 'Llamar a un técnico'.";
                    } else {
                        txtFeedback.Text = "No se detecta un proyector o segunda pantalla";
                        txtSpeech.Text = "Intenté forzar la duplicación de pantalla, pero Windows no detecta un proyector o segunda pantalla conectada. Revisa que el cable HDMI/VGA esté firmemente conectado y que el proyector esté encendido, y vuelve a pulsar 'Duplicar pantalla'. Si persiste, pulsa 'Llamar a un técnico' y generaré un ticket.";
                    }
                    speechScroll.ScrollToTop();
                }));
            });
        }

        // ====================================================================
        // TICKETS DE ATENCIÓN (SE REGISTRAN EN EL PANEL CENTRAL DE SOPORTE TI)
        // ====================================================================
        private void StartTicketMode(string category) {
            ticketMode = true;
            pendingTicketCategory = string.IsNullOrEmpty(category) ? "General" : category;
            txtFeedback.Text = "";
            txtSpeech.Text = "Vamos a crear un ticket de atención. Describe brevemente tu problema en el campo de abajo y pulsa 'Enviar ticket'. Un técnico de Soporte TI será notificado al instante.";
            speechScroll.ScrollToTop();
            txtPlaceholder.Text = "Describe tu problema para el ticket...";
            btnSend.Content = "Enviar ticket";
            txtInput.Focus();
        }

        private void ExitTicketMode() {
            ticketMode = false;
            if (txtPlaceholder != null) txtPlaceholder.Text = "Escribe tu problema o consulta...";
            if (btnSend != null) btnSend.Content = "Consultar";
        }

        private void CreateSupportTicket(string category, string description, string urgency) {
            txtFeedback.Text = "Generando ticket de atención...";
            ThreadPool.QueueUserWorkItem((state) => {
                string ticketId = "";
                string error = null;
                try {
                    string json = string.Format("{{\"hostname\":\"{0}\",\"userName\":\"{1}\",\"category\":\"{2}\",\"description\":\"{3}\",\"urgency\":\"{4}\"}}",
                        EscapeJson(hostname), EscapeJson(username), EscapeJson(category), EscapeJson(description), EscapeJson(urgency));
                    byte[] data = Encoding.UTF8.GetBytes(json);

                    HttpWebRequest req = CreateApiPostRequest("/api/tickets", 12000);
                    using (Stream s = req.GetRequestStream()) {
                        s.Write(data, 0, data.Length);
                    }
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                        ticketId = ExtractJsonStringField(reader.ReadToEnd(), "id");
                    }
                } catch (Exception ex) {
                    error = ex.Message;
                }

                Dispatcher.Invoke((Action)(() => {
                    if (error == null) {
                        string idText = string.IsNullOrEmpty(ticketId) ? "" : " #" + ticketId.ToUpperInvariant();
                        txtFeedback.Text = "[OK] Ticket" + idText + " creado";
                        txtSpeech.Text = string.Format("He creado tu ticket de atención{0} en la categoría '{1}'. El equipo de Soporte TI ya fue notificado y un técnico se acercará a tu equipo ({2}) lo antes posible.", idText, category, hostname);
                    } else {
                        txtFeedback.Text = "No se pudo crear el ticket";
                        txtSpeech.Text = "No pude registrar el ticket porque no hay conexión con la central de Soporte TI (" + error + "). Intenta nuevamente en unos minutos.";
                    }
                    speechScroll.ScrollToTop();
                }));
            });
        }

        // 2. Tengo problemas con el audio
        private void ExecuteAudioTroubleshoot() {
            ThreadPool.QueueUserWorkItem((state) => {
                try {
                    Dispatcher.Invoke((Action)(() => {
                        txtFeedback.Text = "Reiniciando servicios de audio...";
                    }));

                    ProcessStartInfo psi = new ProcessStartInfo {
                        FileName = "cmd.exe",
                        Arguments = "/c net stop audiosrv && net start audiosrv",
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true
                    };
                    Process p = Process.Start(psi);
                    if (p != null) p.WaitForExit(7000);

                    Dispatcher.Invoke((Action)(() => {
                        txtFeedback.Text = "[OK] Audio de Windows reiniciado!";
                        txtSpeech.Text = "He reiniciado los servicios de sonido de Windows (Audiosrv). Verifica en la barra de tareas que el dispositivo de salida correcto esté seleccionado (Altavoces o Auriculares) y que el volumen no esté en silencio.";
                        speechScroll.ScrollToTop();
                    }));
                } catch (Exception ex) {
                    Dispatcher.Invoke((Action)(() => {
                        txtFeedback.Text = "Error en audio: " + ex.Message;
                    }));
                }
            });
        }

        // 3. El equipo está lento (lentitud, cuelgues o páginas que tardan en cargar)
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private class MEMORYSTATUSEX {
            public uint dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
            public uint dwMemoryLoad;
            public ulong ullTotalPhys;
            public ulong ullAvailPhys;
            public ulong ullTotalPageFile;
            public ulong ullAvailPageFile;
            public ulong ullTotalVirtual;
            public ulong ullAvailVirtual;
            public ulong ullAvailExtendedVirtual;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

        private void ExecutePerformanceTroubleshoot() {
            txtFeedback.Text = "Optimizando el equipo, espera unos segundos...";
            ThreadPool.QueueUserWorkItem((state) => {
                StringBuilder report = new StringBuilder();
                try {
                    // 1) Cerrar programas que no responden (colgados)
                    string[] protectedNames = { "explorer", "stivie", "dwm", "csrss", "winlogon", "system", "idle", "svchost", "lsass", "services" };
                    int myPid = Process.GetCurrentProcess().Id;
                    var closed = new System.Collections.Generic.List<string>();
                    foreach (Process p in Process.GetProcesses()) {
                        try {
                            if (p.Id == myPid || p.MainWindowHandle == IntPtr.Zero) continue;
                            if (Array.IndexOf(protectedNames, p.ProcessName.ToLowerInvariant()) >= 0) continue;
                            if (!p.Responding) {
                                string name = p.ProcessName;
                                p.Kill();
                                closed.Add(name);
                            }
                        } catch { }
                    }
                    report.Append(closed.Count > 0
                        ? "✔ Cerré programas colgados: " + string.Join(", ", closed.ToArray()) + ".\n"
                        : "✔ No hay programas colgados.\n");

                    // 2) Limpiar archivos temporales antiguos
                    long freed = 0;
                    try {
                        foreach (string f in Directory.GetFiles(Path.GetTempPath())) {
                            try {
                                FileInfo fi = new FileInfo(f);
                                if (fi.LastWriteTime < DateTime.Now.AddDays(-1)) {
                                    long len = fi.Length;
                                    fi.Delete();
                                    freed += len;
                                }
                            } catch { }
                        }
                    } catch { }
                    report.AppendFormat("✔ Temporales liberados: {0:0.0} MB.\n", freed / 1048576.0);

                    // 3) Renovar caché DNS (páginas que tardan en cargar)
                    try {
                        Process dns = Process.Start(new ProcessStartInfo {
                            FileName = "ipconfig.exe",
                            Arguments = "/flushdns",
                            UseShellExecute = false,
                            CreateNoWindow = true
                        });
                        if (dns != null) dns.WaitForExit(5000);
                        report.Append("✔ Caché DNS renovada.\n");
                    } catch { }

                    // 4) Verificar conexión a internet
                    bool online = false;
                    try {
                        using (System.Net.NetworkInformation.Ping ping = new System.Net.NetworkInformation.Ping()) {
                            online = ping.Send("8.8.8.8", 2500).Status == System.Net.NetworkInformation.IPStatus.Success;
                        }
                        if (online) Dns.GetHostEntry("www.google.com");
                    } catch { online = false; }
                    report.Append(online ? "✔ Internet funcionando correctamente.\n" : "✖ Sin conexión a internet: revisa el cable de red o el Wi-Fi.\n");

                    // 5) Uso de memoria RAM y programas más pesados
                    MEMORYSTATUSEX mem = new MEMORYSTATUSEX();
                    if (GlobalMemoryStatusEx(mem)) {
                        report.AppendFormat("• Memoria RAM en uso: {0}%.\n", mem.dwMemoryLoad);
                    }
                    var procs = new System.Collections.Generic.List<Process>(Process.GetProcesses());
                    procs.Sort((a, b) => { try { return b.WorkingSet64.CompareTo(a.WorkingSet64); } catch { return 0; } });
                    var top = new System.Collections.Generic.List<string>();
                    foreach (Process p in procs) {
                        try {
                            if (top.Count >= 3) break;
                            top.Add(string.Format("{0} ({1} MB)", p.ProcessName, p.WorkingSet64 / 1048576));
                        } catch { }
                    }
                    if (top.Count > 0) report.Append("• Programas que más consumen: " + string.Join(", ", top.ToArray()) + ".\n");

                    report.Append("\nSi el equipo sigue lento, cierra las pestañas del navegador que no uses o reinicia el equipo. Si persiste, pulsa 'Llamar a un técnico'.");

                    Dispatcher.Invoke((Action)(() => {
                        txtFeedback.Text = "[OK] Optimización completada";
                        txtSpeech.Text = report.ToString();
                        speechScroll.ScrollToTop();
                    }));
                } catch (Exception ex) {
                    Dispatcher.Invoke((Action)(() => {
                        txtFeedback.Text = "Error al optimizar: " + ex.Message;
                    }));
                }
            });
        }

        // ====================================================================
        // CHAT CON ASISTENTE TÉCNICO
        // ====================================================================
        private void SendChatMessage() {
            string q = txtInput.Text.Trim();
            if (string.IsNullOrEmpty(q)) return;

            // Modo ticket: el texto escrito se registra como ticket de atención
            if (ticketMode) {
                txtInput.Text = "";
                string category = pendingTicketCategory;
                ExitTicketMode();
                ShowDefaultOptions();
                CreateSupportTicket(category, q, "media");
                return;
            }

            // Solicitud explícita de ticket / técnico
            if (q.IndexOf("ticket", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("tecnico", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("técnico", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("incidencia", StringComparison.OrdinalIgnoreCase) >= 0) {
                txtInput.Text = "";
                if (q.Length >= 25) {
                    CreateSupportTicket("General", q, "media");
                } else {
                    StartTicketMode("General");
                }
                return;
            }

            txtInput.Text = "";
            txtFeedback.Text = "STIVIE está procesando tu consulta...";
            btnSend.IsEnabled = false;

            // Atajos directos a las opciones predeterminadas
            if (q.IndexOf("proyect", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("pantalla", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("duplica", StringComparison.OrdinalIgnoreCase) >= 0) {
                btnSend.IsEnabled = true;
                ShowScreenOptions();
                return;
            }

            if (q.IndexOf("audio", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("sonido", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("volumen", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("escuch", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("pronlema", StringComparison.OrdinalIgnoreCase) >= 0) {
                btnSend.IsEnabled = true;
                ShowAudioOptions();
                return;
            }

            if (q.IndexOf("carga", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("lento", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("lenta", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("cuelga", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("colg", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("congel", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("no abre", StringComparison.OrdinalIgnoreCase) >= 0 ||
                q.IndexOf("no responde", StringComparison.OrdinalIgnoreCase) >= 0) {
                btnSend.IsEnabled = true;
                ShowPerformanceOptions();
                return;
            }

            ThreadPool.QueueUserWorkItem((state) => {
                string answerText = "";
                try {
                    string json = string.Format("{{\"query\":\"{0}\",\"userName\":\"{1}\",\"hostname\":\"{2}\"}}",
                        EscapeJson(q), EscapeJson(username), EscapeJson(hostname));
                    byte[] b = Encoding.UTF8.GetBytes(json);

                    HttpWebRequest req = CreateApiPostRequest("/api/stivie/chat", 20000);
                    using (Stream s = req.GetRequestStream()) {
                        s.Write(b, 0, b.Length);
                    }

                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                        string respText = reader.ReadToEnd();
                        answerText = ExtractJsonStringField(respText, "answer");
                        if (string.IsNullOrEmpty(answerText)) {
                            answerText = ExtractJsonStringField(respText, "reply");
                        }
                    }
                } catch (Exception ex) {
                    answerText = string.Format("No pude conectar con la central ({0}). Si persiste, notifica al equipo de Soporte TI.", ex.Message);
                }

                Dispatcher.Invoke((Action)(() => {
                    btnSend.IsEnabled = true;
                    txtFeedback.Text = "";
                    if (string.IsNullOrEmpty(answerText)) {
                        txtSpeech.Text = string.Format("He registrado tu requerimiento: '{0}'. El equipo de Soporte TI te atenderá pronto.", q);
                    } else {
                        txtSpeech.Text = CleanMarkdown(answerText);
                        speechScroll.ScrollToTop();
                    }
                }));
            });
        }

        private static string EscapeJson(string s) {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }

        private static string ExtractJsonStringField(string json, string fieldName) {
            if (string.IsNullOrEmpty(json)) return "";
            string search = "\"" + fieldName + "\":";
            int idx = json.IndexOf(search);
            if (idx < 0) return "";
            int start = json.IndexOf('"', idx + search.Length);
            if (start < 0) return "";
            start++;

            StringBuilder sb = new StringBuilder();
            bool escaped = false;
            for (int i = start; i < json.Length; i++) {
                char c = json[i];
                if (escaped) {
                    if (c == '"') sb.Append('"');
                    else if (c == '\\') sb.Append('\\');
                    else if (c == 'n') sb.Append('\n');
                    else if (c == 'r') sb.Append('\r');
                    else if (c == 't') sb.Append('\t');
                    else if (c == 'u' && i + 4 < json.Length) {
                        string hex = json.Substring(i + 1, 4);
                        int code;
                        if (int.TryParse(hex, NumberStyles.HexNumber, null, out code)) {
                            sb.Append((char)code);
                            i += 4;
                        } else {
                            sb.Append(c);
                        }
                    } else {
                        sb.Append(c);
                    }
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    break;
                } else {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }

        private static string CleanMarkdown(string text) {
            if (string.IsNullOrEmpty(text)) return "";
            return text.Replace("**", "")
                       .Replace("### ", "")
                       .Replace("## ", "")
                       .Replace("# ", "")
                       .Replace("```powershell", "")
                       .Replace("```cmd", "")
                       .Replace("```", "")
                       .Trim();
        }

        private void SetupRemotePolling() {
            remotePollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(4) };
            remotePollTimer.Tick += (sender, args) => {
                ThreadPool.QueueUserWorkItem((state) => {
                    try {
                        string payload = string.Format("{{\"hostname\":\"{0}\",\"user\":\"{1}\"}}", EscapeJson(hostname), EscapeJson(username));
                        byte[] data = Encoding.UTF8.GetBytes(payload);

                        HttpWebRequest req = CreateApiPostRequest("/api/agent/ping", 6000);
                        using (Stream s = req.GetRequestStream()) {
                            s.Write(data, 0, data.Length);
                        }

                        using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                        using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                            string text = reader.ReadToEnd();
                            if (text.Contains("display_clone") || text.Contains("screen_assist")) {
                                Dispatcher.Invoke((Action)(() => {
                                    ExecuteScreenTroubleshoot();
                                    txtSpeech.Text = "Soporte TI ha activado la duplicación de pantalla en tu proyector.";
                                }));
                            } else if (text.Contains("display_internal")) {
                                try { Process.Start(new ProcessStartInfo(@"C:\Windows\System32\DisplaySwitch.exe", "/internal") { CreateNoWindow = true, UseShellExecute = false }); } catch { }
                            } else if (text.Contains("display_extend")) {
                                try { Process.Start(new ProcessStartInfo(@"C:\Windows\System32\DisplaySwitch.exe", "/extend") { CreateNoWindow = true, UseShellExecute = false }); } catch { }
                            } else if (text.Contains("display_external")) {
                                try { Process.Start(new ProcessStartInfo(@"C:\Windows\System32\DisplaySwitch.exe", "/external") { CreateNoWindow = true, UseShellExecute = false }); } catch { }
                            } else if (text.Contains("audio_fix") || text.Contains("audio_restart")) {
                                Dispatcher.Invoke((Action)(() => {
                                    ExecuteAudioTroubleshoot();
                                }));
                            } else if (text.Contains("performance_fix") || text.Contains("power_check")) {
                                Dispatcher.Invoke((Action)(() => {
                                    ExecutePerformanceTroubleshoot();
                                }));
                            } else if (text.Contains("\"restart\"")) {
                                try { Process.Start(new ProcessStartInfo("shutdown.exe", "/r /t 5 /f /c \"Reinicio corporativo Tay-Audit ejecutado desde la central\"") { CreateNoWindow = true, UseShellExecute = false }); } catch { }
                            } else if (text.Contains("\"shutdown\"")) {
                                try { Process.Start(new ProcessStartInfo("shutdown.exe", "/s /t 5 /f /c \"Apagado corporativo Tay-Audit ejecutado desde la central\"") { CreateNoWindow = true, UseShellExecute = false }); } catch { }
                            }
                        }
                    } catch { }
                });
            };
            remotePollTimer.Start();
        }
    }

    public static class Program {
        private static void CleanupDesktopShortcuts() {
            try {
                System.Collections.Generic.List<string> desktopFolders = new System.Collections.Generic.List<string> {
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)
                };
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                if (!string.IsNullOrEmpty(userProfile)) {
                    desktopFolders.Add(Path.Combine(userProfile, "Desktop"));
                    desktopFolders.Add(Path.Combine(userProfile, "Escritorio"));
                }
                string oneDrive = Environment.GetEnvironmentVariable("OneDrive");
                if (!string.IsNullOrEmpty(oneDrive)) {
                    desktopFolders.Add(Path.Combine(oneDrive, "Desktop"));
                    desktopFolders.Add(Path.Combine(oneDrive, "Escritorio"));
                }

                foreach (string dir in desktopFolders) {
                    if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) continue;
                    foreach (string pattern in new string[] { "*STIVIE*.lnk", "*STIVIE*.url", "*stivie-installer*.bat", "*Tay-Audit*.lnk", "*TayAudit*.lnk" }) {
                        try {
                            foreach (string file in Directory.GetFiles(dir, pattern)) {
                                try { File.Delete(file); } catch { }
                            }
                        } catch { }
                    }
                }

                // En Startup solo limpiar versiones antiguas u obsoletas de Tay-Audit
                try {
                    string startup = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                    if (Directory.Exists(startup)) {
                        foreach (string pattern in new string[] { "*Tay-Audit*.lnk", "*TayAudit*.lnk", "*STIVIE_Widget*.lnk" }) {
                            foreach (string file in Directory.GetFiles(startup, pattern)) {
                                try { File.Delete(file); } catch { }
                            }
                        }
                    }
                } catch { }
            } catch { }
        }

        private static void EnsureAutoStart(string serverUrl) {
            try {
                string exePath = Process.GetCurrentProcess().MainModule.FileName;
                if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath)) return;
                string runValue = "\"" + exePath + "\" \"" + serverUrl + "\"";

                // 1. Registro Run en HKCU
                try {
                    using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true)) {
                        if (key != null) {
                            key.SetValue("STIVIE", runValue);
                        }
                    }
                } catch { }

                // 2. Acceso directo en carpeta de inicio de Windows (Startup)
                try {
                    string startupFolder = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                    if (Directory.Exists(startupFolder)) {
                        string lnkPath = Path.Combine(startupFolder, "STIVIE.lnk");
                        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                        if (shellType != null) {
                            dynamic shell = Activator.CreateInstance(shellType);
                            dynamic shortcut = shell.CreateShortcut(lnkPath);
                            shortcut.TargetPath = exePath;
                            shortcut.Arguments = "\"" + serverUrl + "\"";
                            shortcut.WorkingDirectory = Path.GetDirectoryName(exePath);
                            shortcut.WindowStyle = 7;
                            shortcut.Save();
                        }
                    }
                } catch { }
            } catch { }
        }

        private static Mutex appMutex;

        [STAThread]
        public static void Main(string[] args) {
            bool isNewInstance = false;
            appMutex = new Mutex(true, @"Local\STIVIE_SingleInstance_Mutex", out isNewInstance);
            if (!isNewInstance) {
                // Instancia previa ya activa, salir silenciosamente
                return;
            }

            string errLog = Path.Combine(Path.GetTempPath(), "stivie_error.log");
            try {
                try {
                    ServicePointManager.Expect100Continue = true;
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                    try { ServicePointManager.SecurityProtocol |= (SecurityProtocolType)12288; } catch { }
                } catch { }

                string serverUrl = args.Length > 0 ? args[0] : "https://tay-audit.pages.dev";
                CleanupDesktopShortcuts();
                EnsureAutoStart(serverUrl);

                File.WriteAllText(errLog, "Main start: " + DateTime.Now + "\n");
                AppDomain.CurrentDomain.UnhandledException += (s, e) => {
                    File.AppendAllText(errLog, "AppDomain unhandled: " + e.ExceptionObject + "\n");
                };

                Application app = new Application();
                app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
                app.DispatcherUnhandledException += (s, e) => {
                    File.AppendAllText(errLog, "Dispatcher unhandled: " + e.Exception + "\n");
                    e.Handled = true;
                };

                StivieWindow win = new StivieWindow(serverUrl);
                win.Show();
                app.Run(win);
                File.AppendAllText(errLog, "app.Run returned: " + DateTime.Now + "\n");
            } catch (Exception ex) {
                File.AppendAllText(errLog, "Fatal catch: " + ex + "\n");
            } finally {
                if (appMutex != null) {
                    try { appMutex.ReleaseMutex(); } catch { }
                    appMutex.Dispose();
                }
            }
        }
    }
}
