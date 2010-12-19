package hr.fer.zemris.utils.jetty;

import java.awt.BorderLayout;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.util.component.LifeCycle;
import org.eclipse.jetty.util.component.LifeCycle.Listener;

public class JettyControlGUI extends JFrame {
	private static final long serialVersionUID = 1L;

	private final JTextArea status = new JTextArea();
	private final JScrollPane statusScroll = new JScrollPane(status);

	private Server server;

	private JettyControlGUI(String title) {
		this.setTitle(title);
		Dimension d = new Dimension(550, 300);
		this.setPreferredSize(d);
		this.setMinimumSize(d);
		this.setMaximumSize(d);
		this.setResizable(false);
		OutputStream os = new TextAreaOutputStream(status);
		PrintStream out = new PrintStream(os);
		System.setOut(out);
		System.setErr(out);
	}
	
	private void initGUI() {
		Container contentPane = this.getContentPane();
		contentPane.setLayout(new BorderLayout());
		contentPane.add(new JButton(new AbstractAction("Stop Server!") {
			private static final long serialVersionUID = 1L;

			@Override
			public void actionPerformed(final ActionEvent e) {
				new SwingWorker<Object, Object>() {

					@Override
					protected Object doInBackground()
							throws Exception {
						if (server.isRunning()) {
							try {
								server.stop();
								((JButton) e.getSource())
										.setText("Start Server!");
							} catch (Exception ex) {
								ex.printStackTrace();
							}
						} else {
							try {
								server.start();
								((JButton) e.getSource())
										.setText("Stop Server!");
							} catch (Exception ex) {
								ex.printStackTrace();
							}
						}
						return null;
					}

				}.execute();

			}

		}), BorderLayout.NORTH);
		contentPane.add(statusScroll, BorderLayout.CENTER);
		this.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
	}

	public static void initGUI(final Server server, final String title) {
		
		SwingUtilities.invokeLater(new Runnable() {

			@Override
			public void run() {
				final JettyControlGUI gui = new JettyControlGUI(title);
				gui.server = server;
				gui.initGUI();
				
				server.addLifeCycleListener(new Listener() {

					@Override
					public void lifeCycleFailure(LifeCycle arg0, Throwable arg1) {
						gui.status.append("Server Failiure\r\n");
					}

					@Override
					public void lifeCycleStarted(LifeCycle arg0) {
						gui.status.append("Server started!\r\n");
					}

					@Override
					public void lifeCycleStarting(LifeCycle arg0) {
						gui.status.append("Server starting...\r\n");
					}

					@Override
					public void lifeCycleStopped(LifeCycle arg0) {
						gui.status.append("Server stopped!\r\n");
					}

					@Override
					public void lifeCycleStopping(LifeCycle arg0) {
						gui.status.append("Server stopping!\r\n");
					}

				});
				
				gui.setVisible(true);
			}

		});
	}

	public static class TextAreaOutputStream extends OutputStream {

		private JTextArea textArea;

		public TextAreaOutputStream(JTextArea textArea) {
			this.textArea = textArea;
		}

		@Override
		public void write(int b) throws IOException {
			textArea.append(String.valueOf((char) b));
			textArea.setCaretPosition(textArea.getDocument().getLength());
		}

	}
}
